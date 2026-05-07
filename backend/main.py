import logging
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from contextlib import asynccontextmanager
import asyncio
from datetime import date, timedelta
from typing import Optional, List
from sqlalchemy import desc
from sqlalchemy.future import select

from database import init_db, get_db, async_session, Admin, AttendanceLog
import crud
from websocket_manager import manager
from zk_listener import start_listener
from sync import heartbeat, on_reconnect
import schemas
import auth

# FastAPI lifespan for background tasks
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB (creates sqlite tables if absent)
    await init_db()
    
    # Start zk_listener and heartbeat as background tasks
    loop = asyncio.get_running_loop()
    listener_task = loop.create_task(start_listener())
    heartbeat_task = loop.create_task(heartbeat())
    
    yield
    
    # Cleanup tasks on shutdown
    listener_task.cancel()
    heartbeat_task.cancel()

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI(title="Attendance System API", lifespan=lifespan)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print("VALIDATION ERROR:", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

# CORS enabled for http://localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket /ws — React connects here to receive live punch events"""
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from client, but we must read to detect disconnects gracefully
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        
# REST Endpoints
@app.get("/attendance")
async def get_attendance_logs(
    date_val: Optional[date] = Query(None, alias="date", description="YYYY-MM-DD"),
    user_id: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50)
):
    """GET /attendance?date=YYYY-MM-DD&user_id= — filtered, paginated attendance logs"""
    async with async_session() as db:
        results = await crud.get_logs(db, target_date=date_val, user_id=user_id, skip=skip, limit=limit)
        
        response = []
        for log, user_name in results:
            response.append({
                "id": log.id,
                "user_id": log.user_id,
                "name": user_name,
                "timestamp": log.timestamp,
                "server_timestamp": log.server_timestamp,
                "punch_type": log.punch_type,
                "verify_type": log.verify_type,
                "sync_status": log.sync_status
            })
        return response

@app.get("/device/status")
async def read_device_status():
    """GET /device/status — returns {online, last_seen, missed_punches}"""
    async with async_session() as db:
        status = await crud.get_device_status(db, "192.168.10.40")
        if status:
            return {
                "online": status.status == "online",
                "last_seen": status.last_ping,
                "missed_punches": status.missed_count
            }
        return {"online": False, "last_seen": None, "missed_punches": 0}

@app.get("/device/history")
async def get_device_history(limit: int = 20):
    """GET /device/history — returns recent connectivity logs"""
    from database import DeviceActivity
    async with async_session() as db:
        result = await db.execute(select(DeviceActivity).order_by(desc(DeviceActivity.timestamp)).limit(limit))
        return result.scalars().all()

@app.post("/device/sync", response_model=schemas.SyncResponse)
async def trigger_device_sync(current_user: Admin = Depends(auth.check_admin)):
    """POST /device/sync — manually trigger offline sync from device memory"""
    synced_records = await on_reconnect()
    if synced_records > 0:
        return {"success": True, "message": "Sync completed successfully.", "synced_records": synced_records}
    else:
        return {"success": True, "message": "No new records to sync or device busy.", "synced_records": 0}

from fastapi import HTTPException

from typing import List

@app.get("/users", response_model=List[schemas.UserOut])
async def get_users(current_user: Admin = Depends(auth.check_admin)):
    """GET /users — return all enrolled users"""
    async with async_session() as db:
        users = await crud.get_all_users(db)
        return users

@app.post("/users", response_model=schemas.UserOut)
async def create_user(user: schemas.UserCreate, current_user: Admin = Depends(auth.check_admin)):
    """POST /users — create a new user on the device and sync to DB."""
    try:
        from sync import push_user_to_device
        await push_user_to_device(user.user_id, user.name, user.password, user.privilege)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to push user to device. Ensure it is online. Error: {str(e)}")

    async with async_session() as db:
        db_user = await crud.get_or_create_user(db, user.user_id, user.name)
        if user.department:
            db_user.department = user.department
        if user.shift_id:
            db_user.shift_id = user.shift_id
        if user.privilege is not None:
            db_user.privilege = user.privilege
        if user.password:
            db_user.password = user.password
            
        await db.commit()
        await db.refresh(db_user)
        return db_user

@app.put("/users/{user_id}", response_model=schemas.UserOut)
async def update_user_details(user_id: str, user_update: schemas.UserUpdate, current_user: Admin = Depends(auth.check_admin)):
    """Update user details and sync to device if privilege or name changed."""
    async with async_session() as db:
        db_user = await crud.update_user(db, user_id, user_update)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # If privilege, name, or password was updated, push to device
        if any(v is not None for v in [user_update.privilege, user_update.name, user_update.password]):
            try:
                from sync import push_user_to_device
                # Use current values from DB for fields not in update
                await push_user_to_device(
                    user_id=db_user.user_id,
                    name=db_user.name,
                    password=db_user.password or "",
                    privilege=db_user.privilege
                )
            except Exception as e:
                logger.error(f"Failed to push updated user to device: {e}")
                # We still return the DB update success, but maybe with a warning?
                # For now, just log the error.
        
        return db_user

# Shift Endpoints
@app.get("/shifts", response_model=List[schemas.ShiftOut])
async def get_all_shifts():
    """GET /shifts — return all defined working shifts"""
    async with async_session() as db:
        return await crud.get_shifts(db)
from sqlalchemy.future import select

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    async with async_session() as db:
        # First, try to login as Admin
        result = await db.execute(select(Admin).filter(Admin.username == form_data.username))
        admin = result.scalars().first()
        
        if admin and auth.verify_password(form_data.password, admin.hashed_password):
            access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = auth.create_access_token(
                data={"sub": admin.username, "role": admin.role}, 
                expires_delta=access_token_expires
            )
            return {
                "access_token": access_token, 
                "token_type": "bearer", 
                "role": admin.role, 
                "name": admin.username,
                "privileges": json.loads(admin.privileges) if admin.privileges else []
            }
        
        # If not admin, try to login as a normal User
        from database import User
        result = await db.execute(select(User).filter(User.user_id == form_data.username))
        user = result.scalars().first()
        
        # Check if user exists and has a password set (we'll allow simple PIN or password check)
        # Note: For biometric users, some systems use their PIN as password.
        if user and user.password == form_data.password:
            access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = auth.create_access_token(
                data={"sub": user.user_id, "role": user.role}, 
                expires_delta=access_token_expires
            )
            return {
                "access_token": access_token, 
                "token_type": "bearer", 
                "role": user.role, 
                "name": user.name,
                "privileges": ["dashboard", "reports", "logs", "settings"] # Default for biometric users
            }

        # If both fail
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.get("/admin/me")
async def read_users_me(current_user: Admin = Depends(auth.get_current_user)):
    return {"username": current_user.username, "role": current_user.role}

@app.post("/seed-admin")
async def seed_admin():
    async with async_session() as db:
        # Check if any admin exists
        result = await db.execute(select(Admin))
        if result.scalars().first():
            return {"message": "Admin already exists"}
        
        # Create default super admin
        hashed_pw = auth.get_password_hash("admin123")
        all_privs = json.dumps(["dashboard", "users", "reports", "logs", "privileges", "admins", "settings", "system"])
        new_admin = Admin(username="admin", hashed_password=hashed_pw, role="super_admin", privileges=all_privs)
        db.add(new_admin)
        await db.commit()
        return {"message": "Super Admin created. Login with admin / admin123"}

# Admin Management
@app.post("/admins", response_model=schemas.AdminOut)
async def create_admin(admin: schemas.AdminCreate, super_admin: Admin = Depends(auth.check_super_admin)):
    """Only super_admin can create new admins/super_admins"""
    async with async_session() as db:
        hashed_pw = auth.get_password_hash(admin.password)
        new_admin = Admin(
            username=admin.username,
            hashed_password=hashed_pw,
            role=admin.role,
            privileges=json.dumps(admin.privileges)
        )
        db.add(new_admin)
        try:
            await db.commit()
            await db.refresh(new_admin)
            # Convert privileges back to list for response
            res = schemas.AdminOut.model_validate(new_admin)
            res.privileges = json.loads(new_admin.privileges)
            return res
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=400, detail="Username already exists")

@app.get("/admins", response_model=List[schemas.AdminOut])
async def list_admins(super_admin: Admin = Depends(auth.check_super_admin)):
    """List all administrative users"""
    async with async_session() as db:
        result = await db.execute(select(Admin))
        admins = result.scalars().all()
        # Convert privileges to list
        for adm in admins:
            adm.privileges = json.loads(adm.privileges) if isinstance(adm.privileges, str) else adm.privileges
        return admins

@app.delete("/admins/{admin_id}")
async def delete_admin(admin_id: int, super_admin: Admin = Depends(auth.check_super_admin)):
    """Only super_admin can delete other admins"""
    if admin_id == super_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    async with async_session() as db:
        admin = await db.get(Admin, admin_id)
        if not admin:
            raise HTTPException(status_code=404, detail="Admin not found")
        await db.delete(admin)
        await db.commit()
        return {"success": True, "message": "Admin deleted successfully"}

@app.put("/admins/{admin_id}", response_model=schemas.AdminOut)
async def update_admin_role(admin_id: int, update_data: schemas.AdminUpdate, super_admin: Admin = Depends(auth.check_super_admin)):
    """Only super_admin can update roles/usernames of other admins"""
    async with async_session() as db:
        admin = await db.get(Admin, admin_id)
        if not admin:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        if update_data.username:
            admin.username = update_data.username
        if update_data.password:
            admin.hashed_password = auth.get_password_hash(update_data.password)
        if update_data.role:
            admin.role = update_data.role
        if update_data.privileges is not None:
            admin.privileges = json.dumps(update_data.privileges)
            
        await db.commit()
        await db.refresh(admin)
        # Convert back
        admin.privileges = json.loads(admin.privileges)
        return admin

@app.put("/admin/me", response_model=schemas.AdminOut)
async def update_my_profile(update_data: schemas.AdminUpdate, current_user: Admin = Depends(auth.get_current_user)):
    """Allow any admin to update their own username or password"""
    async with async_session() as db:
        # We need to re-fetch or use the current_user but attached to db
        user = await db.get(Admin, current_user.id)
        if update_data.username:
            user.username = update_data.username
        if update_data.password:
            user.hashed_password = auth.get_password_hash(update_data.password)
        
        await db.commit()
        await db.refresh(user)
        return user

@app.post("/shifts", response_model=schemas.ShiftOut)
async def create_new_shift(shift: schemas.ShiftCreate, current_user: Admin = Depends(auth.check_admin)):
    """POST /shifts — define a new working shift"""
    async with async_session() as db:
        return await crud.create_shift(db, shift)

@app.post("/users/{user_id}/shift")
async def assign_shift_to_user(user_id: str, shift_id: int, current_user: Admin = Depends(auth.check_admin)):
    """POST /users/{user_id}/shift — assign a shift to a specific user"""
    async with async_session() as db:
        user = await crud.assign_user_shift(db, user_id, shift_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "message": f"Shift {shift_id} assigned to user {user_id}"}

# Report Endpoints
@app.get("/reports/attendance")
async def get_attendance_report_endpoint(
    eth_year: Optional[int] = Query(None, description="Ethiopian Year"),
    eth_month: Optional[int] = Query(None, description="Ethiopian Month"),
    eth_day: Optional[int] = Query(None, description="Ethiopian Day"),
    name: Optional[str] = Query(None, description="Filter by user name"),
    month: Optional[int] = Query(None, description="Month (1-13) for monthly view"),
    year: Optional[int] = Query(None, description="Year for monthly view"),
    target_date: Optional[date] = Query(None, description="Gregorian target date"),
    current_user = Depends(auth.get_current_user)
):
    """GET /reports/attendance — returns a full report (daily or monthly)"""
    async with async_session() as db:
        # If the current user is a normal 'user', they can ONLY see their own data
        effective_name_filter = name
        user_id_restrict = None
        
        # We need to distinguish between Admin model and User model results from get_current_user
        # Based on my change in auth.py, it returns either.
        # Check if it's a normal user
        # In main.py, I should check if current_user has 'role' attribute or if it's the User model.
        is_admin = getattr(current_user, 'role', 'user') in ['admin', 'super_admin']
        
        if not is_admin:
            # It's a normal user, restrict by their user_id
            user_id_restrict = current_user.user_id
            
        report = await crud.get_attendance_report(db, eth_year=eth_year, eth_month=eth_month, eth_day=eth_day, name_filter=effective_name_filter, month=month, year=year, target_date=target_date)

        
        if not is_admin:
            # Filter the report to only include this user
            report = [r for r in report if r['user_id'] == user_id_restrict]
            
        return report

@app.get("/attendance/latest-date")
async def get_latest_log_date():
    """Returns the most recent date that has attendance logs."""
    async with async_session() as db:
        result = await db.execute(select(AttendanceLog.timestamp).order_by(desc(AttendanceLog.timestamp)).limit(1))
        latest = result.scalars().first()
        if latest:
            return {"date": latest.date().isoformat()}
        return {"date": date.today().isoformat()}

@app.put("/attendance/{log_id}")
async def update_log(log_id: int, update_data: schemas.AttendanceUpdate, super_admin: Admin = Depends(auth.check_super_admin)):
    """Allow Super Admin to correct punch times/types"""
    async with async_session() as db:
        log = await crud.update_attendance_log(db, log_id, update_data)
        if not log:
            raise HTTPException(status_code=404, detail="Log not found")
        return log


@app.post("/seed-shifts")
async def seed_shifts():
    """Seed default shift requested by user."""
    from schemas import ShiftCreate
    default_shift = ShiftCreate(
        name="Standard Office Hours",
        start_time_1="07:30",
        end_time_1="12:00",
        start_time_2="14:00",
        end_time_2="17:30",
        total_hours_required=8.0
    )
    async with async_session() as db:
        try:
            await crud.create_shift(db, default_shift)
            return {"success": True, "message": "Default shift seeded."}
        except Exception as e:
            return {"success": False, "message": str(e)}

@app.get("/settings", response_model=schemas.SystemSettingsOut)
async def get_settings():
    async with async_session() as db:
        return await crud.get_settings(db)

@app.put("/settings", response_model=schemas.SystemSettingsOut)
async def update_settings(settings_update: schemas.SystemSettingsUpdate, current_user: Admin = Depends(auth.check_super_admin)):
    async with async_session() as db:
        return await crud.update_settings(db, settings_update)
