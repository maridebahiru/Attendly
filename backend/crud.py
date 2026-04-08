from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, date

from database import User, AttendanceLog, DeviceStatus
import schemas

async def get_or_create_user(db: AsyncSession, user_id: str, name: str = "Unknown") -> User:
    """Sync user from device, creating them if they do not exist."""
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalars().first()
    
    if not user:
        # Create new user if not found
        user = User(user_id=user_id, name=name)
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            # Handle race condition where user was created by another request
            await db.rollback()
            result = await db.execute(select(User).filter(User.user_id == user_id))
            user = result.scalars().first()
    elif user.name == "Unknown" and name != "Unknown":
        # Update user name if we have a better one now
        user.name = name
        await db.commit()
        await db.refresh(user)
        
    return user

async def save_punch(db: AsyncSession, event: schemas.PunchEvent, device_ip: str) -> Optional[AttendanceLog]:
    """Upsert attendance log, prevent duplicates, and auto-toggle punch status (IN/OUT)."""
    # Ensure user exists before saving punch
    await get_or_create_user(db, event.user_id)
    
    # 1. Determine local today's bounds
    now = datetime.now()
    start_of_day = datetime.combine(now.date(), datetime.min.time())
    end_of_day = datetime.combine(now.date(), datetime.max.time().replace(microsecond=999999))

    # 2. Fetch the absolute last punch for this user TODAY to decide the toggle
    last_punch_query = (
        select(AttendanceLog)
        .filter(AttendanceLog.user_id == event.user_id, 
                AttendanceLog.timestamp >= start_of_day,
                AttendanceLog.timestamp <= end_of_day)
        .order_by(desc(AttendanceLog.timestamp))
        .limit(1)
    )
    result = await db.execute(last_punch_query)
    last_log = result.scalars().first()

    # 3. Logic: If last was IN, this is OUT. Else IN.
    if last_log and last_log.punch_type == "IN":
        punch_type_str = "OUT"
    else:
        punch_type_str = "IN"

    log = AttendanceLog(
        user_id=event.user_id,
        timestamp=event.timestamp,
        punch_type=punch_type_str,
        verify_type=event.verify_type,
        device_ip=device_ip,
        sync_status="synced"
    )
    db.add(log)
    try:
        await db.commit()
        await db.refresh(log)
        return log
    except IntegrityError:
        # Duplicate record caught by the unique constraint (user_id, timestamp)
        await db.rollback()
        return None  # Indicates duplicate

async def get_logs(db: AsyncSession, target_date: Optional[date] = None, user_id: Optional[str] = None, skip: int = 0, limit: int = 50) -> List[tuple]:
    """Get filtered query of attendance logs joined with user names."""
    query = select(AttendanceLog, User.name).join(User, AttendanceLog.user_id == User.user_id)
    
    if target_date:
        # Filter by date (ignoring time)
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time().replace(microsecond=999999))
        query = query.filter(AttendanceLog.timestamp >= start_of_day, AttendanceLog.timestamp <= end_of_day)
        
    if user_id:
        # Filter by specific user id
        query = query.filter(AttendanceLog.user_id == user_id)
        
    query = query.order_by(desc(AttendanceLog.timestamp)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.all() # Returns list of tuples (AttendanceLog, user_name)

async def update_device_status(db: AsyncSession, ip: str, online: bool, missed_count: int = 0):
    """Write heartbeat result to the database."""
    status_str = "online" if online else "offline"
    result = await db.execute(select(DeviceStatus).filter(DeviceStatus.ip == ip))
    device = result.scalars().first()
    
    now = datetime.utcnow()
    
    if not device:
        device = DeviceStatus(ip=ip, status=status_str, last_ping=now, missed_count=missed_count)
        db.add(device)
    else:
        device.status = status_str
        if online:
            device.last_ping = now
        if missed_count > 0 or online:
             device.missed_count = missed_count
             
    await db.commit()

async def get_device_status(db: AsyncSession, ip: str) -> Optional[DeviceStatus]:
    """Retrieve the current device status."""
    result = await db.execute(select(DeviceStatus).filter(DeviceStatus.ip == ip))
    return result.scalars().first()

async def get_all_users(db: AsyncSession) -> List[User]:
    """Return all enrolled users."""
    result = await db.execute(select(User))
    return list(result.scalars().all())

async def get_shifts(db: AsyncSession) -> List[Shift]:
    """Return all defined shifts."""
    from database import Shift # Late import to avoid circular dependencies if any
    result = await db.execute(select(Shift))
    return list(result.scalars().all())

async def create_shift(db: AsyncSession, shift_in: schemas.ShiftCreate) -> Shift:
    """Create a new shift definition."""
    from database import Shift
    db_shift = Shift(**shift_in.model_dump())
    db.add(db_shift)
    await db.commit()
    await db.refresh(db_shift)
    return db_shift

async def assign_user_shift(db: AsyncSession, user_id: str, shift_id: int):
    """Assign a user to a specific shift."""
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalars().first()
    if user:
        user.shift_id = shift_id
        await db.commit()
        await db.refresh(user)
    return user

from datetime import timedelta

async def get_attendance_report(
    db: AsyncSession, 
    target_date: Optional[date] = None, 
    name_filter: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
) -> List[dict]:
    """Generate a report with worked hours calculation, late detection, and monthly filtering."""
    from database import Shift
    from datetime import date as d_type, time as t_type
    
    # 1. Fetch users (potentially filtered by name)
    users_query = select(User)
    if name_filter:
        users_query = users_query.filter(User.name.ilike(f"%{name_filter}%"))
    
    users_result = await db.execute(users_query)
    users = users_result.scalars().all()
    
    # 2. Fetch all shifts for lookup
    shifts_result = await db.execute(select(Shift))
    shifts = {s.id: s for s in shifts_result.scalars().all()}
    
    report = []
    
    # Define date range for logs
    if month and year:
        import calendar
        _, last_day = calendar.monthrange(year, month)
        start_date = d_type(year, month, 1)
        end_date = d_type(year, month, last_day)
    else:
        # Fallback to single target_date or today
        target = target_date or date.today()
        start_date = target
        end_date = target

    start_bounds = datetime.combine(start_date, datetime.min.time())
    end_bounds = datetime.combine(end_date, datetime.max.time().replace(microsecond=999999))
    
    for user in users:
        # Fetch logs for this user in range
        logs_result = await db.execute(
            select(AttendanceLog)
            .filter(AttendanceLog.user_id == user.user_id, 
                    AttendanceLog.timestamp >= start_bounds, 
                    AttendanceLog.timestamp <= end_bounds)
            .order_by(AttendanceLog.timestamp)
        )
        logs = logs_result.scalars().all()
        
        # Group logs by date to calculate per-day metrics
        logs_by_date = {}
        for log in logs:
            d = log.timestamp.date()
            if d not in logs_by_date: logs_by_date[d] = []
            logs_by_date[d].append(log)
            
        total_seconds = 0
        all_punches = []
        late_count = 0
        overtime_hours = 0.0
        
        shift = shifts.get(user.shift_id)
        
        for d, day_logs in logs_by_date.items():
            day_seconds = 0
            last_in = None
            
            # Late detection (first punch of the day compared to shift start)
            if shift and day_logs:
                try:
                    shift_h, shift_m = map(int, shift.start_time_1.split(':'))
                    first_punch_time = day_logs[0].timestamp.time()
                    if first_punch_time > t_type(shift_h, shift_m):
                        late_count += 1
                except: pass

            for log in day_logs:
                all_punches.append({"date": d.isoformat(), "time": log.timestamp.strftime("%H:%M"), "type": log.punch_type})
                if log.punch_type == "IN":
                    last_in = log.timestamp
                elif log.punch_type == "OUT" and last_in:
                    duration = log.timestamp - last_in
                    day_seconds += duration.total_seconds()
                    last_in = None
            
            total_seconds += day_seconds
            
            # Simple daily overtime check
            if shift:
                day_hours = day_seconds / 3600
                if day_hours > shift.total_hours_required:
                    overtime_hours += (day_hours - shift.total_hours_required)
        
        hours_worked = round(total_seconds / 3600, 2)
        
        report.append({
            "user_id": user.user_id,
            "name": user.name,
            "department": user.department,
            "total_hours": hours_worked,
            "late_count": late_count,
            "overtime_hours": round(overtime_hours, 2),
            "shift_name": shift.name if shift else "No Shift",
            "required_hours": shift.total_hours_required if shift else 8.0,
            "status": "Present" if logs else "Absent",
            "punches_count": len(logs)
        })
        
    return report

async def update_attendance_log(db: AsyncSession, log_id: int, update_data: schemas.AttendanceUpdate) -> Optional[AttendanceLog]:
    """Execute update on a specific punch log."""
    result = await db.execute(select(AttendanceLog).filter(AttendanceLog.id == log_id))
    log = result.scalars().first()
    
    if not log:
        return None
        
    if update_data.timestamp is not None:
        log.timestamp = update_data.timestamp
    if update_data.punch_type is not None:
        log.punch_type = update_data.punch_type
        
    await db.commit()
    await db.refresh(log)
    return log
