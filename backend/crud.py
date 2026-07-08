from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, date, timedelta
import logging

logger = logging.getLogger(__name__)

import schemas
from ethiopian_date import gregorian_to_ethiopian, ethiopian_to_gregorian
from database import User, AttendanceLog, DeviceStatus, SystemSettings, Shift, AbsenceReport, EthiopianHoliday

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

def classify_punch_time(l_time, settings) -> str:
    from datetime import time
    def parse_time(t_str):
        h, m = map(int, t_str.split(':'))
        return time(h, m)
    
    try:
        if parse_time(settings.morning_in_start) <= l_time <= parse_time(settings.morning_in_end):
            return "Morning In"
        elif parse_time(settings.morning_out_start) <= l_time <= parse_time(settings.morning_out_end):
            return "Morning Out"
        elif parse_time(settings.afternoon_in_start) <= l_time <= parse_time(settings.afternoon_in_end):
            return "Afternoon In"
        elif parse_time(settings.afternoon_out_start) <= l_time <= parse_time(settings.afternoon_out_end):
            return "Afternoon Out"
    except Exception:
        pass
    return "Unclassified"

async def save_punch(db: AsyncSession, event: schemas.PunchEvent, device_ip: str) -> Optional[AttendanceLog]:
    """Upsert attendance log, prevent duplicates, and auto-toggle punch status (IN/OUT)."""
    # Ensure user exists before saving punch
    await get_or_create_user(db, event.user_id)
    
    # 1. Determine standard today's bounds (using Ethiopian day bounds)
    # event.timestamp is the raw Ethiopian timestamp from the device
    corrected_timestamp = event.timestamp + timedelta(hours=6)
    eth_day = event.timestamp.date()
    
    start_of_day = datetime.combine(eth_day, datetime.min.time()) + timedelta(hours=6)
    end_of_day = datetime.combine(eth_day, datetime.max.time().replace(microsecond=999999)) + timedelta(hours=6)

    # 2. Fetch the absolute last punch for this user TODAY (same Ethiopian day) to decide the toggle
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

    # Determine toggle status
    if last_log:
        time_diff = (corrected_timestamp - last_log.timestamp).total_seconds()
        if time_diff < 300: # 5 minutes threshold
            logger.info(f"Ignoring duplicate punch for user {event.user_id} at {corrected_timestamp} (within 5 minutes)")
            return None
        punch_type_str = "OUT" if last_log.punch_type == "IN" else "IN"
    else:
        punch_type_str = "IN"

    # Get settings for range checks
    settings = await get_settings(db)
    punch_label = classify_punch_time(corrected_timestamp.time(), settings)

    log = AttendanceLog(
        user_id=event.user_id,
        timestamp=corrected_timestamp,
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
        # Reclassify to ensure perfect chronological labels!
        await reclassify_all_punches(db)
        await db.refresh(log)
        return log
    except IntegrityError:
        # Duplicate record caught by the unique constraint (user_id, original_timestamp)
        await db.rollback()
        return None  # Indicates duplicate

async def get_logs(db: AsyncSession, target_date: Optional[date] = None, user_id: Optional[str] = None, skip: int = 0, limit: int = 50) -> List[tuple]:
    """Get filtered query of attendance logs joined with user names."""
    query = select(AttendanceLog, User.name).join(User, AttendanceLog.user_id == User.user_id)
    
    if target_date:
        # Filter by Ethiopian day bounds (which are standard time bounds shifted by +6 hours)
        start_of_day = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=6)
        end_of_day = datetime.combine(target_date, datetime.max.time().replace(microsecond=999999)) + timedelta(hours=6)
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
    target_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id_filter: Optional[str] = None
) -> List[dict]:
    """Generate an enhanced report with worked hours, late minutes, early departures, and missing punches.
    Updated to support custom shifts (2-punch single sessions, assigned days) and approved absences."""
    from database import Shift, AbsenceReport
    from datetime import date as d_type, time as t_type, datetime as dt_type
    import calendar
    
    # 1. Fetch settings for global off-days and work times
    settings = await get_settings(db)
    off_days = [d.strip() for d in settings.off_days.split(",") if d.strip()]
    
    # 2. Fetch users
    users_query = select(User)
    if name_filter:
        users_query = users_query.filter(User.name.ilike(f"%{name_filter}%"))
    if user_id_filter:
        users_query = users_query.filter(User.user_id == user_id_filter)
    
    users_result = await db.execute(users_query)
    users = users_result.scalars().all()
    
    # 3. Fetch all shifts
    shifts_result = await db.execute(select(Shift))
    shifts = {s.id: s for s in shifts_result.scalars().all()}
    
    # 4. Define date range
    if start_date and end_date:
        start_date_g = start_date
        end_date_g = end_date
    elif eth_year and eth_month:
        if eth_day:
            # Daily report for specific Ethiopian date
            target_date = ethiopian_to_gregorian(eth_year, eth_month, eth_day)
            start_date_g = target_date
            end_date_g = target_date
        else:
            # Monthly report for specific Ethiopian month
            start_date_g = ethiopian_to_gregorian(eth_year, eth_month, 1)
            # Find last day of Ethiopian month (Pagume is 13th month, has 5 or 6 days depending on leap year)
            last_day = 30
            if eth_month == 13:
                is_leap = (eth_year % 4 == 3)
                last_day = 6 if is_leap else 5
            end_date_g = ethiopian_to_gregorian(eth_year, eth_month, last_day)
    elif target_date:
        start_date_g = target_date
        end_date_g = target_date
    elif month and year:
        _, last_day = calendar.monthrange(year, month)
        start_date_g = d_type(year, month, 1)
        end_date_g = d_type(year, month, last_day)
    else:
        start_date_g = date.today()
        end_date_g = start_date_g

    start_bounds = dt_type.combine(start_date_g, t_type.min) + timedelta(hours=6)
    end_bounds = dt_type.combine(end_date_g, t_type.max.replace(microsecond=999999)) + timedelta(hours=6)
    
    all_logs_query = select(AttendanceLog).filter(
        AttendanceLog.timestamp >= start_bounds, 
        AttendanceLog.timestamp <= end_bounds
    ).order_by(AttendanceLog.timestamp)
    all_logs_result = await db.execute(all_logs_query)
    all_logs = all_logs_result.scalars().all()
    
    # Fetch approved absence reports for the date range
    absence_query = select(AbsenceReport).filter(
        AbsenceReport.date >= start_date_g.isoformat(),
        AbsenceReport.date <= end_date_g.isoformat(),
        AbsenceReport.status == "approved"
    )
    absence_result = await db.execute(absence_query)
    absences = absence_result.scalars().all()
    
    absence_lookup = {}
    for abs_rep in absences:
        if abs_rep.user_id not in absence_lookup:
            absence_lookup[abs_rep.user_id] = {}
        absence_lookup[abs_rep.user_id][abs_rep.date] = abs_rep.reason
    
    # Fetch public holidays for the date range
    holidays_query = select(EthiopianHoliday).filter(
        EthiopianHoliday.date >= start_date_g.isoformat(),
        EthiopianHoliday.date <= end_date_g.isoformat()
    )
    holidays_result = await db.execute(holidays_query)
    holidays = {h.date: h.name for h in holidays_result.scalars().all()}

    logs_by_user = {}
    for log in all_logs:
        if log.user_id not in logs_by_user:
            logs_by_user[log.user_id] = {}
        # Group by Ethiopian day date
        d = (log.timestamp - timedelta(hours=6)).date()
        if d not in logs_by_user[log.user_id]:
            logs_by_user[log.user_id][d] = []
        logs_by_user[log.user_id][d].append(log)
    
    g_days = []
    curr = start_date_g
    while curr <= end_date_g:
        g_days.append(curr)
        curr += timedelta(days=1)

    def calc_stat(actual_dt, target_str, p_type="IN"):
        if not actual_dt: return "Absent", 0
        try:
            target_h, target_m = map(int, target_str.split(':'))
            t_dt = dt_type.combine(actual_dt.date(), t_type(target_h, target_m))
            if p_type == "IN":
                diff = (actual_dt - t_dt).total_seconds() / 60
                if diff > 20: return "Late", int(diff - 20)
                return "On Time", 0
            else: # OUT
                diff = (t_dt - actual_dt).total_seconds() / 60
                if diff > 0: return "Early Departure", int(diff)
                return "On Time", 0
        except: return "Unknown", 0

    report = []
    for user in users:
        user_logs = logs_by_user.get(user.user_id, {})
        user_daily_records = []
        
        shift = shifts.get(user.shift_id)
        
        # Session Target Times
        m_in_t = shift.start_time_1 if shift else settings.morning_in
        m_out_t = shift.end_time_1 if shift else settings.morning_out
        a_in_t = shift.start_time_2 if (shift and shift.start_time_2) else settings.afternoon_in
        a_out_t = shift.end_time_2 if (shift and shift.end_time_2) else settings.afternoon_out
        
        is_two_punch = shift is not None and not shift.start_time_2

        u_total_hrs = 0
        u_late_mins = 0
        u_early_mins = 0
        u_present_days = 0

        for d in g_days:
            day_name = d.strftime("%A")
            
            # Determine off-days based on shift assigned days vs global off-days
            if shift and shift.assigned_days:
                user_assigned_days = [day.strip() for day in shift.assigned_days.split(",") if day.strip()]
                is_off = day_name not in user_assigned_days
            else:
                is_off = day_name in off_days
                
            day_logs = sorted(user_logs.get(d, []), key=lambda x: x.timestamp)
            
            # Filter out duplicate close scans (within 5 minutes)
            valid_logs = []
            unclassified_logs = []
            for log in day_logs:
                if not valid_logs:
                    valid_logs.append(log)
                else:
                    time_diff = (log.timestamp - valid_logs[-1].timestamp).total_seconds()
                    if time_diff >= 300:
                        valid_logs.append(log)
            
            p_map = {"Morning In": None, "Morning Out": None, "Afternoon In": None, "Afternoon Out": None}
            
            if is_two_punch:
                # 2-punch single session shift
                if len(valid_logs) > 0:
                    p_map["Morning In"] = valid_logs[0]
                if len(valid_logs) > 1:
                    p_map["Morning Out"] = valid_logs[-1]
                if len(valid_logs) > 2:
                    unclassified_logs.extend(valid_logs[1:-1])
            else:
                # Default 4-punch system settings or 2-session shift
                slots = ["Morning In", "Morning Out", "Afternoon In", "Afternoon Out"]
                for idx, log in enumerate(valid_logs):
                    if idx < 4:
                        p_map[slots[idx]] = log
                    else:
                        unclassified_logs.append(log)
            
            unclassified_logs = sorted(unclassified_logs, key=lambda x: x.timestamp)

            # Calculate Statuses based on these classified punches
            if is_two_punch:
                mi_s, mi_m = calc_stat(p_map["Morning In"].timestamp if p_map["Morning In"] else None, m_in_t, "IN")
                mo_s, mo_m = calc_stat(p_map["Morning Out"].timestamp if p_map["Morning Out"] else None, m_out_t, "OUT")
                ai_s, ai_m = "On Time", 0
                ao_s, AO_m = "On Time", 0
                
                day_sec = 0
                if p_map["Morning In"] and p_map["Morning Out"]:
                    day_sec += (p_map["Morning Out"].timestamp - p_map["Morning In"].timestamp).total_seconds()
                day_hrs = round(max(0, day_sec / 3600), 2)
                
                scan_count = len([p for p in [p_map["Morning In"], p_map["Morning Out"]] if p])
                if scan_count == 2: d_status = "Present"
                elif scan_count > 0: d_status = "Half Day"
                else: d_status = "Absent"
            else:
                mi_s, mi_m = calc_stat(p_map["Morning In"].timestamp if p_map["Morning In"] else None, m_in_t, "IN")
                mo_s, mo_m = calc_stat(p_map["Morning Out"].timestamp if p_map["Morning Out"] else None, m_out_t, "OUT")
                ai_s, ai_m = calc_stat(p_map["Afternoon In"].timestamp if p_map["Afternoon In"] else None, a_in_t, "IN")
                ao_s, AO_m = calc_stat(p_map["Afternoon Out"].timestamp if p_map["Afternoon Out"] else None, a_out_t, "OUT")

                day_sec = 0
                if p_map["Morning In"] and p_map["Morning Out"]:
                    day_sec += (p_map["Morning Out"].timestamp - p_map["Morning In"].timestamp).total_seconds()
                if p_map["Afternoon In"] and p_map["Afternoon Out"]:
                    day_sec += (p_map["Afternoon Out"].timestamp - p_map["Afternoon In"].timestamp).total_seconds()
                
                day_hrs = round(max(0, day_sec / 3600), 2)
                
                scan_count = len([p for p in p_map.values() if p])
                if scan_count == 4: d_status = "Present"
                elif scan_count > 0: d_status = "Half Day"
                else: d_status = "Absent"
            
            # Check for approved absence report to override status
            user_holiday = holidays.get(d.isoformat())
            user_abs_reason = absence_lookup.get(user.user_id, {}).get(d.isoformat())
            if user_abs_reason:
                d_status = user_abs_reason
                mi_s, mi_m = "On Time", 0
                mo_s, mo_m = "On Time", 0
                ai_s, ai_m = "On Time", 0
                ao_s, AO_m = "On Time", 0
                day_hrs = 0.0
            elif user_holiday:
                d_status = f"Holiday: {user_holiday}"
                mi_s, mi_m = "On Time", 0
                mo_s, mo_m = "On Time", 0
                ai_s, ai_m = "On Time", 0
                ao_s, AO_m = "On Time", 0
                day_hrs = 0.0
            
            if is_off and scan_count == 0 and not user_abs_reason and not user_holiday: 
                d_status = "Off Day"
                
            if d_status in ["Present", "Half Day"]: 
                u_present_days += 1
                
            u_total_hrs += day_hrs
            u_late_mins += (mi_m + ai_m)
            u_early_mins += (mo_m + AO_m)

            # Ethiopian formatting conversions
            eth_date_obj = gregorian_to_ethiopian(d)
            eth_date_str = f"{eth_date_obj.year}-{eth_date_obj.month:02d}-{eth_date_obj.day:02d}"
            
            def format_eth_time(dt) -> str:
                if not dt: return "Not Scanned"
                # Display standard time (with the 6-hour shift included)
                return dt.strftime("%H:%M:%S")

            user_daily_records.append({
                "date": eth_date_str,
                "gregorian_date": d.isoformat(),
                "employee_name": user.name,
                "employee_id": user.user_id,
                "morning_in": format_eth_time(p_map["Morning In"].timestamp) if p_map["Morning In"] else "Not Scanned",
                "morning_in_status": mi_s,
                "morning_out": format_eth_time(p_map["Morning Out"].timestamp) if p_map["Morning Out"] else "Not Scanned",
                "morning_out_status": mo_s,
                "afternoon_in": format_eth_time(p_map["Afternoon In"].timestamp) if p_map["Afternoon In"] else "Not Scanned",
                "afternoon_in_status": ai_s,
                "afternoon_out": format_eth_time(p_map["Afternoon Out"].timestamp) if p_map["Afternoon Out"] else "Not Scanned",
                "afternoon_out_status": ao_s,
                "total_hours": day_hrs,
                "status": d_status,
                "late_minutes": mi_m + ai_m,
                "early_departure_minutes": mo_m + AO_m,
                "unclassified_scans": [format_eth_time(l.timestamp) for l in unclassified_logs]
            })

        # Calculate user-level summary counts
        u_late_count = sum(1 for dr in user_daily_records if dr["late_minutes"] > 0)
        u_early_count = sum(1 for dr in user_daily_records if dr["early_departure_minutes"] > 0)
        u_missing_punches = sum(1 for dr in user_daily_records if dr["status"] == "Half Day")

        # For Dashboard (AttendanceGrid), we want the latest day's punches
        latest_punches = []
        if user_daily_records:
            last_day = user_daily_records[-1]
            for label in ["Morning In", "Morning Out", "Afternoon In", "Afternoon Out"]:
                key = label.lower().replace(" ", "_")
                latest_punches.append({
                    "label": label,
                    "time": last_day[key] if last_day[key] != "Not Scanned" else ""
                })
            # Also add unclassified if any
            for ut in last_day.get("unclassified_scans", []):
                latest_punches.append({
                    "label": "Unclassified",
                    "time": ut
                })

        report.append({
            "user_id": user.user_id,
            "name": user.name,
            "department": user.department,
            "total_hours": round(u_total_hrs, 2),
            "late_minutes": u_late_mins,
            "late_count": u_late_count,
            "early_departure_minutes": u_early_mins,
            "early_departure_count": u_early_count,
            "missing_punches": u_missing_punches,
            "days_present": u_present_days,
            "status": "Present" if u_present_days > 0 else ("Absent" if not user_daily_records else user_daily_records[-1]["status"]),
            "daily_details": user_daily_records,
            "punches": latest_punches
        })

        
    return report

        
    return report

        
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

async def create_absence_report(db: AsyncSession, report: schemas.AbsenceReportCreate, username: str) -> AbsenceReport:
    """Create a new staff absence/unavailability report."""
    db_report = AbsenceReport(
        user_id=report.user_id,
        date=report.date,
        reason=report.reason,
        notes=report.notes,
        status="pending",
        submitted_by=username
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return db_report

async def get_absence_reports(db: AsyncSession, user_id: Optional[str] = None) -> List[tuple]:
    """Get all absence reports with user names."""
    query = select(AbsenceReport, User.name).join(User, AbsenceReport.user_id == User.user_id)
    if user_id:
        query = query.filter(AbsenceReport.user_id == user_id)
    query = query.order_by(desc(AbsenceReport.date))
    result = await db.execute(query)
    return result.all()

async def update_absence_report(db: AsyncSession, report_id: int, update_data: schemas.AbsenceReportUpdate, username: str) -> Optional[AbsenceReport]:
    """Update details or approval status of an absence report."""
    result = await db.execute(select(AbsenceReport).filter(AbsenceReport.id == report_id))
    report = result.scalars().first()
    if not report:
        return None
        
    data = update_data.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(report, key, val)
        
    if "status" in data:
        report.approved_by = username
        
    await db.commit()
    await db.refresh(report)
    return report

async def reclassify_all_punches(db: AsyncSession):
    """Reclassify all database logs chronologically and apply the 6 hours Ethiopian time conversion if not yet applied."""
    from database import AttendanceLog, User, Shift
    from sqlalchemy import select
    
    # 1. Fetch all users and shifts to know if they have custom 2-punch shifts
    users_result = await db.execute(select(User))
    users_dict = {u.user_id: u.shift_id for u in users_result.scalars().all()}
    
    shifts_result = await db.execute(select(Shift))
    shifts_dict = {s.id: s for s in shifts_result.scalars().all()}

    # 2. Fetch all attendance logs sorted by user and timestamp
    result = await db.execute(select(AttendanceLog).order_by(AttendanceLog.user_id, AttendanceLog.timestamp))
    logs = result.scalars().all()
    
    # 3. Apply Ethiopian time conversion (add 6 hours to timestamp if timestamp == original_timestamp)
    updated = False
    logs_by_user_day = {}
    for log in logs:
        # Check if 6 hours shift needs to be applied
        if log.timestamp == log.original_timestamp:
            log.timestamp = log.original_timestamp + timedelta(hours=6)
            updated = True
            
        # Group by user and Ethiopian day date
        day = (log.timestamp - timedelta(hours=6)).date()
        key = (log.user_id, day)
        if key not in logs_by_user_day:
            logs_by_user_day[key] = []
        logs_by_user_day[key].append(log)
        
    # 4. For each user-day group, sort chronologically and assign punch labels & punch types
    for key, day_logs in logs_by_user_day.items():
        user_id = key[0]
        shift_id = users_dict.get(user_id)
        shift = shifts_dict.get(shift_id) if shift_id else None
        is_two_punch = shift is not None and not shift.start_time_2
        
        # Sort logs chronologically
        day_logs.sort(key=lambda x: x.timestamp)
        
        valid_logs = []
        duplicate_logs = []
        for log in day_logs:
            if not valid_logs:
                valid_logs.append(log)
            else:
                time_diff = (log.timestamp - valid_logs[-1].timestamp).total_seconds()
                if time_diff >= 300: # 5 minutes
                    valid_logs.append(log)
                else:
                    duplicate_logs.append(log)
        
        if is_two_punch:
            # 2-punch shift: 1st is Morning In, last is Morning Out, others Unclassified
            if len(valid_logs) > 0:
                if valid_logs[0].punch_label != "Morning In" or valid_logs[0].punch_type != "IN":
                    valid_logs[0].punch_label = "Morning In"
                    valid_logs[0].punch_type = "IN"
                    updated = True
            if len(valid_logs) > 1:
                if valid_logs[-1].punch_label != "Morning Out" or valid_logs[-1].punch_type != "OUT":
                    valid_logs[-1].punch_label = "Morning Out"
                    valid_logs[-1].punch_type = "OUT"
                    updated = True
            for log in valid_logs[1:-1]:
                if log.punch_label != "Unclassified" or log.punch_type != "IN":
                    log.punch_label = "Unclassified"
                    log.punch_type = "IN"
                    updated = True
        else:
            # Default 4-punch chronological
            slots = ["Morning In", "Morning Out", "Afternoon In", "Afternoon Out"]
            for idx, log in enumerate(valid_logs):
                new_label = slots[idx] if idx < 4 else "Unclassified"
                new_type = "IN" if idx % 2 == 0 else "OUT"
                if log.punch_label != new_label or log.punch_type != new_type:
                    log.punch_label = new_label
                    log.punch_type = new_type
                    updated = True
                    
        # Mark all duplicate logs as Unclassified so they don't get mislabeled
        for log in duplicate_logs:
            if log.punch_label != "Unclassified" or log.punch_type != "IN":
                log.punch_label = "Unclassified"
                log.punch_type = "IN"
                updated = True
                    
    if updated:
        await db.commit()

