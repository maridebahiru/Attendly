from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Float
import datetime

DATABASE_URL = "sqlite+aiosqlite:///./attendance.db"

# Create async SQLAlchemy engine
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

class User(Base):
    """Stores user information synced from the device."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False) # The device's internal user ID
    name = Column(String, nullable=False)
    department = Column(String, default="General")
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AttendanceLog(Base):
    """Stores individual punch events."""
    __tablename__ = "attendance_logs"
    __table_args__ = (UniqueConstraint('user_id', 'timestamp', name='_user_timestamp_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    punch_type = Column(String, nullable=False) # "IN" or "OUT"
    verify_type = Column(Integer, nullable=False)
    device_ip = Column(String, nullable=False)
    sync_status = Column(String, default="synced") # "synced" or "pending"
    server_timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class DeviceStatus(Base):
    """Tracks the real-time status of the ZKTeco device."""
    __tablename__ = "device_status"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, unique=True, nullable=False)
    status = Column(String, default="offline") # "online", "offline", "reconnecting"
    last_ping = Column(DateTime, default=datetime.datetime.utcnow)
    missed_count = Column(Integer, default=0)

class Admin(Base):
    """Stores credentials for system administrators."""
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin") # "admin" or "super_admin"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

async def init_db():
    """Initializes the database, creating tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """Dependency to get the database session."""
    async with async_session() as session:
        yield session
