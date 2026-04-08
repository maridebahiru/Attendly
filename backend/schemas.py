from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Any

# Pydantic models for request/response validation

class PunchEvent(BaseModel):
    user_id: str
    timestamp: datetime
    punch: int
    status: int
    verify_type: int
    
class AttendanceLogOut(BaseModel):
    id: int # Added ID to allow editing specific rows
    user_id: str
    name: Optional[str] = None
    timestamp: datetime
    server_timestamp: Optional[datetime] = None
    punch_type: str
    verify_type: int
    sync_status: str
    
    model_config = ConfigDict(from_attributes=True)

class AttendanceUpdate(BaseModel):
    timestamp: Optional[datetime] = None
    punch_type: Optional[str] = None # "IN" or "OUT"

class ShiftCreate(BaseModel):
    name: str
    start_time_1: str
    end_time_1: str
    start_time_2: Optional[str] = None
    end_time_2: Optional[str] = None
    total_hours_required: float = 8.0

class ShiftOut(BaseModel):
    id: int
    name: str
    start_time_1: str
    end_time_1: str
    start_time_2: Optional[str] = None
    end_time_2: Optional[str] = None
    total_hours_required: float

    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    user_id: str
    name: str
    department: str = "General"
    shift_id: Optional[int] = None
    password: str = ""
    privilege: int = 0

class UserOut(BaseModel):
    user_id: str
    name: str
    department: str
    shift_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class AdminCreate(BaseModel):
    username: str
    password: str
    role: str = "admin"

class AdminUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

class AdminOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DeviceStatusOut(BaseModel):
    online: bool
    last_seen: Optional[datetime] = None
    missed_punches: int

class SyncResponse(BaseModel):
    success: bool
    message: str
    synced_records: int
