from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Float
import datetime

import os

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Fallback to local SQLite if DATABASE_URL is empty or invalid
if not DATABASE_URL or "://" not in DATABASE_URL:
    DATABASE_URL = "sqlite+aiosqlite:///./attendance.db"

# Convert Render-style Postgres URL to use the asyncpg driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("sqlite://"):
    DATABASE_URL = DATABASE_URL.replace("sqlite://", "sqlite+aiosqlite://", 1)

def mask_url(url: str) -> str:
    try:
        if "@" in url:
            prefix, suffix = url.split("@", 1)
            scheme_user_pass = prefix.split("://", 1)
            if len(scheme_user_pass) == 2:
                scheme, user_pass = scheme_user_pass
                if ":" in user_pass:
                    user, _ = user_pass.split(":", 1)
                    return f"{scheme}://{user}:****@{suffix}"
            return f"****@{suffix}"
    except Exception:
        pass
    return url

# Create async SQLAlchemy engine
try:
    print(f"Connecting to database URL: {mask_url(DATABASE_URL)}")
    engine = create_async_engine(DATABASE_URL, echo=True)
except Exception as e:
    print(f"DATABASE ERROR: Failed to create engine for URL. Error: {e}")
    print("Falling back to local SQLite database: sqlite+aiosqlite:///./attendance.db")
    DATABASE_URL = "sqlite+aiosqlite:///./attendance.db"
    engine = create_async_engine(DATABASE_URL, echo=False)

# Create session maker
async_session = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

# SQLAlchemy models for four tables: users, attendance_logs, device_status, shifts

class Shift(Base):
    """Defines working hours for different shifts."""
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    # Stored as "HH:MM"
    start_time_1 = Column(String, nullable=False) 
    end_time_1 = Column(String, nullable=False)
    start_time_2 = Column(String, nullable=True) # Optional second part of shift
    end_time_2 = Column(String, nullable=True)
    total_hours_required = Column(Float, default=8.0)
    assigned_days = Column(String, nullable=True, default="Monday,Tuesday,Wednesday,Thursday,Friday")

class AbsenceReport(Base):
    """Stores staff absence/unavailability reports."""
    __tablename__ = "absence_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    date = Column(String, nullable=False, index=True) # Store Gregorian date as "YYYY-MM-DD"
    reason = Column(String, nullable=False) # Sick Leave, Annual Leave, Emergency Leave, Business Trip, Work From Home, Suspended, Other (specified)
    notes = Column(String, nullable=True)
    status = Column(String, default="pending") # "pending", "approved", "rejected"
    submitted_by = Column(String, nullable=False) # Username of Team Leader or Super Admin
    approved_by = Column(String, nullable=True) # Username of Super Admin
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class User(Base):
    """Stores user information synced from the device."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False) # The device's internal user ID
    name = Column(String, nullable=False)
    department = Column(String, default="General")
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    password = Column(String, nullable=True) # Pin/Password for login
    role = Column(String, default="user")
    privilege = Column(Integer, default=0) # 0: User, 14: Super Admin
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AttendanceLog(Base):
    """Stores individual punch events."""
    __tablename__ = "attendance_logs"
    __table_args__ = (UniqueConstraint('user_id', 'original_timestamp', name='_user_original_timestamp_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    original_timestamp = Column(DateTime, nullable=False, index=True)
    punch_type = Column(String, nullable=False) # "IN" or "OUT"
    punch_label = Column(String, nullable=True) # "Morning In", "Morning Out", "Afternoon In", "Afternoon Out"
    verify_type = Column(Integer, nullable=False)
    device_ip = Column(String, nullable=False)
    sync_status = Column(String, default="synced") # "synced" or "pending"
    server_timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Audit fields
    edited_by = Column(String, nullable=True)
    edited_at = Column(DateTime, nullable=True)

class DeviceStatus(Base):
    """Tracks the real-time status of the ZKTeco device."""
    __tablename__ = "device_status"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, unique=True, nullable=False)
    status = Column(String, default="offline") # "online", "offline", "reconnecting"
    last_ping = Column(DateTime, default=datetime.datetime.utcnow)
    missed_count = Column(Integer, default=0)

class DeviceActivity(Base):
    """Logs history of device connectivity."""
    __tablename__ = "device_history"

    id = Column(Integer, primary_key=True, index=True)
    device_ip = Column(String, nullable=False)
    status = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class Admin(Base):
    """Stores credentials for system administrators."""
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin") # "admin" or "super_admin"
    privileges = Column(String, default="[]") # JSON list of accessible modules
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SystemSettings(Base):
    """Global system configuration."""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    entering_time = Column(String, default="08:00")
    out_time = Column(String, default="17:00")
    morning_in = Column(String, default="08:00")
    morning_out = Column(String, default="12:00")
    afternoon_in = Column(String, default="13:00")
    afternoon_out = Column(String, default="17:00")
    off_days = Column(String, default="Saturday,Sunday") # Comma-separated list of day names
    machine_id = Column(Integer, default=1)
    port = Column(Integer, default=4370)
    device_ip = Column(String, default="192.168.10.40")

    # Configurable scan session time ranges
    morning_in_start = Column(String, default="02:00")
    morning_in_end = Column(String, default="03:00")
    morning_out_start = Column(String, default="05:00")
    morning_out_end = Column(String, default="07:00")
    afternoon_in_start = Column(String, default="08:00")
    afternoon_in_end = Column(String, default="09:00")
    afternoon_out_start = Column(String, default="10:00")
    afternoon_out_end = Column(String, default="12:00")

class EthiopianHoliday(Base):
    """Stores fetched Ethiopian public holidays from Calendarific."""
    __tablename__ = "ethiopian_holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(String, unique=True, index=True, nullable=False) # Store Gregorian ISO date "YYYY-MM-DD"
    type = Column(String, nullable=True) # e.g. "National holiday"

async def init_db():
    """Initializes the database, creating tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Get existing columns using reflection to avoid Postgres transaction aborts
    from sqlalchemy import inspect, text
    def get_columns(bind):
        insp = inspect(bind)
        return [c["name"] for c in insp.get_columns("system_settings")]
        
    async with engine.connect() as conn:
        existing_cols = await conn.run_sync(get_columns)
        
    new_cols = [
        ("morning_in_start", "VARCHAR DEFAULT '02:00'"),
        ("morning_in_end", "VARCHAR DEFAULT '03:00'"),
        ("morning_out_start", "VARCHAR DEFAULT '05:00'"),
        ("morning_out_end", "VARCHAR DEFAULT '07:00'"),
        ("afternoon_in_start", "VARCHAR DEFAULT '08:00'"),
        ("afternoon_in_end", "VARCHAR DEFAULT '09:00'"),
        ("afternoon_out_start", "VARCHAR DEFAULT '10:00'"),
        ("afternoon_out_end", "VARCHAR DEFAULT '12:00'")
    ]
    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(f"ALTER TABLE system_settings ADD COLUMN {col_name} {col_type}"))
            except Exception:
                pass
        
    # Ensure default settings exist (run outside of engine.begin to avoid Postgres isolation errors)
    from sqlalchemy import select
    async with async_session() as session:
        result = await session.execute(select(SystemSettings).limit(1))
        if not result.scalars().first():
            session.add(SystemSettings())
            await session.commit()

        # Ensure default admin exists
        result = await session.execute(select(Admin).limit(1))
        if not result.scalars().first():
            import auth
            hashed_pw = auth.get_password_hash("admin123")
            new_admin = Admin(
                username="admin",
                hashed_password=hashed_pw,
                role="super_admin",
                privileges='["dashboard","users","attendance","shifts","absences","reports","settings","admins"]'
            )
            session.add(new_admin)
            await session.commit()
            print("Default admin user 'admin' seeded successfully.")

async def get_db():
    """Dependency to get the database session."""
    async with async_session() as session:
        yield session
