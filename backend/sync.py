import asyncio
import logging
from datetime import datetime, timedelta
from zk import ZK
from sqlalchemy.dialects.sqlite import insert

from database import async_session
import crud
from websocket_manager import manager

logger = logging.getLogger(__name__)

# Global state to prevent concurrent syncs
_is_syncing = False

def fetch_holidays_from_api(year: int) -> list:
    import urllib.request
    import urllib.parse
    import json
    import os
    
    api_key = os.getenv("CALENDARIFIC_API_KEY", "8y0eFBsrD0uy69YlIhlPGnStPaql7dBU")
    url = f"https://calendarific.com/api/v2/holidays?api_key={api_key}&country={urllib.parse.quote('ET')}&year={year}"
    
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                return data.get("response", {}).get("holidays", [])
    except Exception as e:
        logger.error(f"Error calling Calendarific API: {e}")
    return []

async def sync_ethiopian_holidays():
    """Fetch and sync Ethiopian public holidays from Calendarific once a year."""
    logger.info("Checking Ethiopian public holidays cache...")
    try:
        from datetime import date
        from database import EthiopianHoliday
        from sqlalchemy import select
        
        current_year = date.today().year
        
        # Determine if the new Ethiopian year has started (September 11 or 12)
        is_new_ethiopian_year = (date.today().month > 9) or (date.today().month == 9 and date.today().day >= 11)
        
        years_to_sync = [current_year]
        if is_new_ethiopian_year:
            years_to_sync.append(current_year + 1)
            
        async with async_session() as db:
            for year in years_to_sync:
                # Check if we already have holidays for this Gregorian year cached
                res = await db.execute(select(EthiopianHoliday).filter(EthiopianHoliday.date.like(f"{year}-%")))
                existing = res.scalars().all()
                
                if existing:
                    logger.info(f"Holidays for year {year} are already cached ({len(existing)} found).")
                    continue
                
                logger.info(f"Fetching Ethiopian holidays for year {year} from Calendarific...")
                loop = asyncio.get_running_loop()
                holidays = await loop.run_in_executor(None, fetch_holidays_from_api, year)
                
                if holidays:
                    logger.info(f"Successfully fetched {len(holidays)} holidays from Calendarific for year {year}.")
                    
                    # Exclude existing dates to avoid duplicate key errors
                    res_all = await db.execute(select(EthiopianHoliday.date))
                    all_existing_dates = set(res_all.scalars().all())
                    
                    new_holidays = []
                    for h in holidays:
                        h_date = h.get("date", {}).get("iso")
                        if h_date:
                            h_date = h_date.split("T")[0] # YYYY-MM-DD
                            
                        if h_date and h_date not in all_existing_dates:
                            h_type = h.get("type", ["National holiday"])[0]
                            new_holidays.append(EthiopianHoliday(
                                name=h.get("name"),
                                date=h_date,
                                type=h_type
                            ))
                            all_existing_dates.add(h_date)
                    
                    if new_holidays:
                        db.add_all(new_holidays)
                        await db.commit()
                        logger.info(f"Successfully saved {len(new_holidays)} new Ethiopian holidays to the database for year {year}.")
                else:
                    logger.warning(f"No holidays fetched for year {year} (could be API rate limit or offline).")
    except Exception as e:
        logger.error(f"Error in sync_ethiopian_holidays: {e}")

async def heartbeat():
    """Ping device every 30s, update device_status table, broadcast status to clients."""
    while True:
        try:
            async with async_session() as db:
                settings = await crud.get_settings(db)
                device_ip = settings.device_ip
                device_port = settings.port

            # Simple async tcp ping to check if the device responds to socket connection
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(device_ip, device_port), 
                    timeout=2.0
                )
                writer.close()
                await writer.wait_closed()
                is_online = True
            except (asyncio.TimeoutError, OSError):
                is_online = False

            async with async_session() as db:
                # Get current missed count to broadcast accurately
                device_status = await crud.get_device_status(db, device_ip)
                missed_count = device_status.missed_count if device_status else 0
                
                await crud.update_device_status(db, device_ip, online=is_online, missed_count=missed_count)
            
            # Broadcast status to WebSocket clients
            await manager.broadcast({
                "type": "device_status",
                "status": "online" if is_online else "offline",
                "ip": device_ip,
                "missed_count": missed_count
            })
            
            # Wait for 30 seconds before next ping
            await asyncio.sleep(30)
            
            # Additional periodic sync as fallback for live listener
            # This ensures data is fetched even if live capture fails
            await on_reconnect()
            
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
        async with async_session() as db:
            settings = await crud.get_settings(db)
            device_ip = settings.device_ip
            device_port = settings.port

        # ZK library is blocking, so we must run it in a thread executor to avoid blocking asyncio event loop
        loop = asyncio.get_running_loop()
        attendance_records, users = await loop.run_in_executor(None, fetch_all_data, device_ip, device_port)
        
        async with async_session() as db:
            # 1. Update/Sync all users first so foreign keys match
            if users:
                for user in users:
                    await crud.get_or_create_user(db, str(user.user_id), user.name or "Unknown")
                    
            # 2. Bulk insert missed records using INSERT OR IGNORE
            if attendance_records:
                # Get system settings for classifying punches
                settings = await crud.get_settings(db)
                
                 # Prepare data dicts for SQLite bulk insert
                records_to_insert = []
                
                for att in attendance_records:
                    user_id = str(att.user_id)
                    corrected_timestamp = att.timestamp
                    l_time = corrected_timestamp.time()
                    
                    punch_label = crud.classify_punch_time(l_time, settings)
                    punch_str = "OUT" if att.punch == 1 else "IN"
                    
                    records_to_insert.append({
                        "user_id": user_id,
                        "timestamp": corrected_timestamp,
                        "original_timestamp": att.timestamp,
                        "punch_type": punch_str,
                        "punch_label": punch_label,
                        "verify_type": getattr(att, 'status', 0), 
                        "device_ip": device_ip,
                        "sync_status": "synced"
                    })
                
                if records_to_insert:
                    from database import AttendanceLog, engine
                    
                    if "postgresql" in engine.url.drivername:
                        from sqlalchemy.dialects.postgresql import insert as pg_insert
                        stmt = pg_insert(AttendanceLog).values(records_to_insert)
                        stmt = stmt.on_conflict_do_nothing(index_elements=['user_id', 'original_timestamp'])
                    else:
                        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                        stmt = sqlite_insert(AttendanceLog).values(records_to_insert)
                        stmt = stmt.on_conflict_do_nothing(index_elements=['user_id', 'original_timestamp'])
                    
                    result = await db.execute(stmt)
                    await db.commit()
                    # Reclassify all punches chronologically to ensure they are 100% correct!
                    await crud.reclassify_all_punches(db)
                    synced_count = getattr(result, "rowcount", len(records_to_insert)) # rough approximation
                    
            # Reset missed count
            await crud.update_device_status(db, device_ip, online=True, missed_count=0)
            
        if synced_count > 0:
            await manager.broadcast({
                "type": "sync_complete",
                "synced_count": synced_count
            })
            
        logger.info(f"Successfully synced {synced_count} records")
        return synced_count
        
    except Exception as e:
        logger.error(f"Failed to sync data on reconnect: {e}")
        return 0
    finally:
        _is_syncing = False

def fetch_all_data(device_ip, device_port):
    """Blocking function to fetch users and attendance from device. Run in executor."""
    zk = ZK(device_ip, port=device_port, timeout=5, password=0, force_udp=False, ommit_ping=True)
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
    async with async_session() as db:
        settings = await crud.get_settings(db)
        device_ip = settings.device_ip
        device_port = settings.port

    def _push():
        # ommit_ping=False for push stability
        zk = ZK(device_ip, port=device_port, timeout=5, force_udp=False, ommit_ping=False)
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
