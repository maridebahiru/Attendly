import asyncio
import logging
from datetime import datetime
from zk import ZK
from sqlalchemy.dialects.sqlite import insert

from database import async_session
import crud
from websocket_manager import manager

logger = logging.getLogger(__name__)

DEVICE_IP = "192.168.10.40"
DEVICE_PORT = 4370

# Global state to prevent concurrent syncs
_is_syncing = False

async def heartbeat():
    """Ping device every 30s, update device_status table, broadcast status to clients."""
    while True:
        try:
            # Simple async tcp ping to check if the device responds to socket connection
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(DEVICE_IP, DEVICE_PORT), 
                    timeout=2.0
                )
                writer.close()
                await writer.wait_closed()
                is_online = True
            except (asyncio.TimeoutError, OSError):
                is_online = False

            async with async_session() as db:
                # Get current missed count to broadcast accurately
                device_status = await crud.get_device_status(db, DEVICE_IP)
                missed_count = device_status.missed_count if device_status else 0
                
                await crud.update_device_status(db, DEVICE_IP, online=is_online, missed_count=missed_count)
            
            # Broadcast status to WebSocket clients
            await manager.broadcast({
                "type": "device_status",
                "status": "online" if is_online else "offline",
                "ip": DEVICE_IP,
                "missed_count": missed_count
            })
            
            # Wait for 30 seconds before next ping
            await asyncio.sleep(30)
            
        except asyncio.CancelledError:
            logger.info("Heartbeat task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in heartbeat loop: {e}")
            await asyncio.sleep(30)

async def on_reconnect() -> int:
    """Call zk.get_attendance(), bulk insert missed records, mark them 'synced'."""
    global _is_syncing
    
    if _is_syncing:
        logger.warning("Sync already in progress, skipping.")
        return 0
        
    _is_syncing = True
    synced_count = 0
    try:
        # ZK library is blocking, so we must run it in a thread executor to avoid blocking asyncio event loop
        loop = asyncio.get_running_loop()
        attendance_records, users = await loop.run_in_executor(None, fetch_all_data)
        
        async with async_session() as db:
            # 1. Update/Sync all users first so foreign keys match
            if users:
                for user in users:
                    await crud.get_or_create_user(db, str(user.user_id), user.name or "Unknown")
                    
            # 2. Bulk insert missed records using INSERT OR IGNORE
            if attendance_records:
                # Prepare data dicts for SQLite bulk insert
                records_to_insert = []
                for att in attendance_records:
                    punch_str = "OUT" if att.punch == 1 else "IN"
                    records_to_insert.append({
                        "user_id": str(att.user_id),
                        "timestamp": att.timestamp,
                        "punch_type": punch_str,
                        "verify_type": getattr(att, 'status', 0), 
                        "device_ip": DEVICE_IP,
                        "sync_status": "synced"
                    })
                
                if records_to_insert:
                    from database import AttendanceLog
                    # SQLite dialect specific UPSERT / INSERT OR IGNORE
                    stmt = insert(AttendanceLog).values(records_to_insert)
                    stmt = stmt.on_conflict_do_nothing(index_elements=['user_id', 'timestamp'])
                    
                    result = await db.execute(stmt)
                    await db.commit()
                    synced_count = getattr(result, "rowcount", len(records_to_insert)) # rough approximation
                    
            # Reset missed count
            await crud.update_device_status(db, DEVICE_IP, online=True, missed_count=0)
            
        logger.info(f"Successfully synced {synced_count} records")
        return synced_count
        
    except Exception as e:
        logger.error(f"Failed to sync data on reconnect: {e}")
        return 0
    finally:
        _is_syncing = False

def fetch_all_data():
    """Blocking function to fetch users and attendance from device. Run in executor."""
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5, password=0, force_udp=False, ommit_ping=True)
    conn = None
    try:
        conn = zk.connect()
        users = conn.get_users()
        attendance = conn.get_attendance()
        return attendance, users
    except Exception as e:
        logger.error(f"ZK SDK Error during sync: {e}")
        raise
    finally:
        if conn:
            conn.disconnect()

async def push_user_to_device(user_id: str, name: str, password: str = "", privilege: int = 0):
    """Push newly created user details to the biometric terminal."""
    def _push():
        # ommit_ping=False for push stability
        zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5, force_udp=False, ommit_ping=False)
        conn = None
        try:
            conn = zk.connect()
            try:
                uid = int(user_id)
            except ValueError:
                # Basic string hash just to get a numeric uid for pyzk internal referencing
                uid = sum(ord(c) for c in user_id)
                # Keep uid within 16-bit range usually accepted
                uid = uid % 65535 + 1
                
            conn.set_user(uid=uid, name=name, privilege=privilege, password=password, group_id='', user_id=user_id)
            return True
        except Exception as e:
            logger.error(f"Failed to push user to device: {e}")
            raise
        finally:
            if conn:
                conn.disconnect()
                
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _push)
