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
    id: int
    user_id: str
    name: Optional[str] = None
    timestamp: datetime
    original_timestamp: datetime
    server_timestamp: Optional[datetime] = None
    punch_type: str
    punch_label: Optional[str] = None
    verify_type: int
    sync_status: str
    edited_by: Optional[str] = None
    edited_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class AttendanceUpdate(BaseModel):
    timestamp: Optional[datetime] = None
    punch_type: Optional[str] = None # "IN" or "OUT"
    edited_by: Optional[str] = None

class ShiftCreate(BaseModel):
    name: str
    start_time_1: str
    end_time_1: str
    start_time_2: Optional[str] = None
    end_time_2: Optional[str] = None
    total_hours_required: float = 8.0
    assigned_days: Optional[str] = "Monday,Tuesday,Wednesday,Thursday,Friday"

class ShiftOut(BaseModel):
    id: int
    name: str
    start_time_1: str
    end_time_1: str
    start_time_2: Optional[str] = None
    end_time_2: Optional[str] = None
    total_hours_required: float
    assigned_days: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AbsenceReportCreate(BaseModel):
    user_id: str
    date: str # YYYY-MM-DD
    reason: str
    notes: Optional[str] = None

class AbsenceReportUpdate(BaseModel):
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None # approved, rejected

class AbsenceReportOut(BaseModel):
    id: int
    user_id: str
    name: Optional[str] = None # resolved from user_id
    date: str
    reason: str
    notes: Optional[str] = None
    status: str
    submitted_by: str
    approved_by: Optional[str] = None
    created_at: datetime

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
    privilege: int = 0
    role: str = "user"
    
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    shift_id: Optional[int] = None
    password: Optional[str] = None
    privilege: Optional[int] = None
    role: Optional[str] = None

class AdminCreate(BaseModel):
    username: str
    password: str
    role: str = "admin"
    privileges: List[str] = []

class AdminUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    privileges: Optional[List[str]] = None

class AdminOut(BaseModel):
    id: int
    username: str
    role: str
    privileges: List[str] = []
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

class SystemSettingsUpdate(BaseModel):
    entering_time: Optional[str] = None
    out_time: Optional[str] = None
    morning_in: Optional[str] = None
    morning_out: Optional[str] = None
    afternoon_in: Optional[str] = None
    afternoon_out: Optional[str] = None
    off_days: Optional[str] = None
    machine_id: Optional[int] = None
    port: Optional[int] = None
    device_ip: Optional[str] = None
    morning_in_start: Optional[str] = None
    morning_in_end: Optional[str] = None
    morning_out_start: Optional[str] = None
    morning_out_end: Optional[str] = None
    afternoon_in_start: Optional[str] = None
    afternoon_in_end: Optional[str] = None
    afternoon_out_start: Optional[str] = None
    afternoon_out_end: Optional[str] = None

class SystemSettingsOut(BaseModel):
    entering_time: str
    out_time: str
    morning_in: str
    morning_out: str
    afternoon_in: str
    afternoon_out: str
    off_days: str
    machine_id: int
    port: int
    device_ip: str
    morning_in_start: str
    morning_in_end: str
    morning_out_start: str
    morning_out_end: str
    afternoon_in_start: str
    afternoon_in_end: str
    afternoon_out_start: str
    afternoon_out_end: str

    model_config = ConfigDict(from_attributes=True)
