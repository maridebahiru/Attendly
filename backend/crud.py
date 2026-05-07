from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, date

import schemas
from ethiopian_date import gregorian_to_ethiopian, ethiopian_to_gregorian
from database import User, AttendanceLog, DeviceStatus, SystemSettings, Shift

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

    # 3. Logic: Determine sequential label and toggle status
    # We count existing logs for this user today to determine the original sequence
    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count(AttendanceLog.id))
        .filter(AttendanceLog.user_id == event.user_id, 
                AttendanceLog.timestamp >= start_of_day,
                AttendanceLog.timestamp <= end_of_day)
    )
    punch_count = count_result.scalar() or 0
    
    labels = ["Morning In", "Morning Out", "Afternoon In", "Afternoon Out"]
    punch_label = labels[punch_count] if punch_count < len(labels) else f"Extra {punch_count + 1}"

    if last_log and last_log.punch_type == "IN":
        punch_type_str = "OUT"
    else:
        punch_type_str = "IN"

    log = AttendanceLog(
        user_id=event.user_id,
        timestamp=event.timestamp,
        original_timestamp=event.timestamp,
        punch_type=punch_type_str,
        punch_label=punch_label,
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
    from database import DeviceActivity
    status_str = "online" if online else "offline"
    result = await db.execute(select(DeviceStatus).filter(DeviceStatus.ip == ip))
    device = result.scalars().first()
    
    now = datetime.utcnow()
    
    # Check if status has changed
    if not device:
        device = DeviceStatus(ip=ip, status=status_str, last_ping=now, missed_count=missed_count)
        db.add(device)
        # Log first transition
        db.add(DeviceActivity(device_ip=ip, status=status_str, timestamp=now))
    else:
        if device.status != status_str:
            # Status changed, log it
            db.add(DeviceActivity(device_ip=ip, status=status_str, timestamp=now))
            
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

async def update_user(db: AsyncSession, user_id: str, user_update: schemas.UserUpdate) -> Optional[User]:
    """Update user details in database."""
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalars().first()
    
    if not user:
        return None
        
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
        
    await db.commit()
    await db.refresh(user)
    return user

async def get_settings(db: AsyncSession) -> SystemSettings:
    """Retrieve global system settings."""
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalars().first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings

async def update_settings(db: AsyncSession, settings_update: schemas.SystemSettingsUpdate) -> SystemSettings:
    """Update global system settings."""
    settings = await get_settings(db)
    update_data = settings_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    await db.commit()
    await db.refresh(settings)
    return settings

from datetime import timedelta

async def get_attendance_report(
    db: AsyncSession, 
    eth_year: Optional[int] = None,
    eth_month: Optional[int] = None,
    eth_day: Optional[int] = None,
    name_filter: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    target_date: Optional[date] = None
) -> List[dict]:
    """Generate an enhanced report with worked hours, late minutes, early departures, and missing punches.
    Supports Ethiopian Calendar dates if month/year/target_date are provided as Ethiopian."""
    from database import Shift
    from datetime import date as d_type, time as t_type, datetime as dt_type
    import calendar
    
    # 1. Fetch settings for global off-days and work times
    settings = await get_settings(db)
    off_days = [d.strip() for d in settings.off_days.split(",") if d.strip()]
    
    # 2. Fetch users
    users_query = select(User)
    if name_filter:
        users_query = users_query.filter(User.name.ilike(f"%{name_filter}%"))
    
    users_result = await db.execute(users_query)
    users = users_result.scalars().all()
    
    # 3. Fetch all shifts
    shifts_result = await db.execute(select(Shift))
    shifts = {s.id: s for s in shifts_result.scalars().all()}
    
    report = []
    
    # 4. Define date range (Input is Ethiopian or Gregorian target_date)
    if month and year:
        # Determine number of days in Ethiopian month
        if month <= 12:
            last_day = 30
        else:
            # 13th month
            if (year + 1) % 4 == 0:
                last_day = 6
            else:
                last_day = 5
        
        start_date_eth = (year, month, 1)
        end_date_eth = (year, month, last_day)
        # Convert Ethiopian range to Gregorian range for DB query
        start_date_g = ethiopian_to_gregorian(*start_date_eth)
        end_date_g = ethiopian_to_gregorian(*end_date_eth)
    elif eth_year and eth_month and eth_day:
        start_date_g = ethiopian_to_gregorian(eth_year, eth_month, eth_day)
        end_date_g = start_date_g
    elif target_date:
        start_date_g = target_date
        end_date_g = target_date
    else:
        # Default to today Gregorian
        start_date_g = date.today()
        end_date_g = start_date_g

    
    start_bounds = dt_type.combine(start_date_g, t_type.min)
    end_bounds = dt_type.combine(end_date_g, t_type.max.replace(microsecond=999999))
    
    # Pre-fetch all logs in range to avoid N+1 queries
    all_logs_query = select(AttendanceLog).filter(
        AttendanceLog.timestamp >= start_bounds, 
        AttendanceLog.timestamp <= end_bounds
    ).order_by(AttendanceLog.timestamp)
    all_logs_result = await db.execute(all_logs_query)
    all_logs = all_logs_result.scalars().all()
    
    logs_by_user = {}
    for log in all_logs:
        if log.user_id not in logs_by_user:
            logs_by_user[log.user_id] = {}
        d = log.timestamp.date()
        if d not in logs_by_user[log.user_id]:
            logs_by_user[log.user_id][d] = []
        logs_by_user[log.user_id][d].append(log)

    # List of Gregorian days in range
    g_days = []
    curr = start_date_g
    while curr <= end_date_g:
        g_days.append(curr)
        curr += timedelta(days=1)

    for user in users:
        user_logs = logs_by_user.get(user.user_id, {})
        
        total_seconds = 0
        total_late_minutes = 0
        total_early_departure_minutes = 0
        late_count = 0
        early_departure_count = 0
        missing_punch_days = 0
        days_present = 0
        days_absent = 0
        all_punches = []
        
        shift = shifts.get(user.shift_id)
        # Use global settings if no shift
        s_start_time = shift.start_time_1 if shift else settings.entering_time
        s_end_time = shift.end_time_1 if shift else settings.out_time
        s_req_hours = shift.total_hours_required if shift else 8.0

        for d in g_days:
            # Check if this Gregorian day is an Ethiopian off-day
            eth_d = gregorian_to_ethiopian(d)
            # Weekday mapping: Gregorian week matches Ethiopian week order
            day_name = d.strftime("%A") 
            is_off_day = day_name in off_days
            
            day_logs = user_logs.get(d, [])
            day_seconds = 0
            
            if not day_logs:
                if not is_off_day:
                    days_absent += 1
                continue
            
            days_present += 1
            
            # Missing Punches Check
            if len(day_logs) % 2 != 0:
                missing_punch_days += 1

            try:
                # Late Arrival Calculation
                shift_h, shift_m = map(int, s_start_time.split(':'))
                first_punch = day_logs[0]
                if first_punch.punch_type == "IN":
                    fp_time = first_punch.timestamp.time()
                    shift_start = t_type(shift_h, shift_m)
                    if fp_time > shift_start:
                        diff = dt_type.combine(d, fp_time) - dt_type.combine(d, shift_start)
                        mins = int(diff.total_seconds() / 60)
                        if mins > 2: # 2 min grace
                            late_count += 1
                            total_late_minutes += mins
                
                # Early Departure Calculation
                last_punch = day_logs[-1]
                if last_punch.punch_type == "OUT":
                    lp_time = last_punch.timestamp.time()
                    shift_end_h, shift_end_m = map(int, s_end_time.split(':'))
                    shift_end = t_type(shift_end_h, shift_end_m)
                    if lp_time < shift_end:
                        diff = dt_type.combine(d, shift_end) - dt_type.combine(d, lp_time)
                        mins = int(diff.total_seconds() / 60)
                        if mins > 2:
                            early_departure_count += 1
                            total_early_departure_minutes += mins
            except Exception:
                pass

            # Work Duration Calculation
            for i in range(0, len(day_logs) - 1, 2):
                if day_logs[i].punch_type == "IN" and day_logs[i+1].punch_type == "OUT":
                    duration = day_logs[i+1].timestamp - day_logs[i].timestamp
                    day_seconds += duration.total_seconds()
            
            for log in day_logs:
                all_punches.append({
                    "date": eth_d.to_isoformat(), # Return Ethiopian date
                    "time": log.timestamp.strftime("%H:%M:%S"), 
                    "type": log.punch_type,
                    "label": log.punch_label,
                    "id": log.id
                })
            
            total_seconds += day_seconds
            
        hours_worked = round(total_seconds / 3600, 2)
        overtime_hours = 0.0
        # Calculate overtime only if present
        for d, day_logs in user_logs.items():
            day_sec = 0
            for i in range(0, len(day_logs) - 1, 2):
                if day_logs[i].punch_type == "IN" and day_logs[i+1].punch_type == "OUT":
                    day_sec += (day_logs[i+1].timestamp - day_logs[i].timestamp).total_seconds()
            
            day_hrs = day_sec / 3600
            if day_hrs > s_req_hours:
                overtime_hours += (day_hrs - s_req_hours)

        status = "Present" if days_present > 0 else "Absent"
        if days_absent > 0 and days_present > 0:
            status = "Partial"
            
        report.append({
            "user_id": user.user_id,
            "name": user.name,
            "department": user.department,
            "total_hours": hours_worked,
            "days_present": days_present,
            "days_absent": days_absent,
            "late_count": late_count,
            "late_minutes": total_late_minutes,
            "early_departure_count": early_departure_count,
            "early_departure_minutes": total_early_departure_minutes,
            "missing_punches": missing_punch_days,
            "overtime_hours": round(overtime_hours, 2),
            "shift_name": shift.name if shift else "Global Settings",
            "daily_required": s_req_hours,
            "total_required": round(s_req_hours * (days_present + days_absent), 2),
            "status": status,
            "punches": all_punches
        })
        
    return report

async def update_attendance_log(db: AsyncSession, log_id: int, update_data: schemas.AttendanceUpdate) -> Optional[AttendanceLog]:
    """Execute update on a specific punch log. Preserves punch_label but updates audit fields."""
    result = await db.execute(select(AttendanceLog).filter(AttendanceLog.id == log_id))
    log = result.scalars().first()
    
    if not log:
        return None
        
    if update_data.timestamp is not None:
        # Convert string to datetime if needed (though FastAPI usually handles this via schema)
        log.timestamp = update_data.timestamp
        
    if update_data.punch_type is not None:
        log.punch_type = update_data.punch_type
    
    # Audit trail
    log.edited_by = update_data.edited_by
    log.edited_at = datetime.utcnow()
        
    await db.commit()
    await db.refresh(log)
    return log
