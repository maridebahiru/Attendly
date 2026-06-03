import asyncio
import logging
from zk import ZK
from datetime import datetime, timedelta

from database import async_session
import crud
from websocket_manager import manager
from schemas import PunchEvent
from sync import on_reconnect

logger = logging.getLogger(__name__)

async def start_listener():
    """Main loop for listening to live capture events."""
    print("DEBUG: Entering start_listener...")
    logger.info("Starting ZKTeco live listener...")
    attempt = 0
    max_attempts = 5
    
    while True:
        try:
            # Fetch settings from DB
            async with async_session() as db:
                settings = await crud.get_settings(db)
                device_ip = settings.device_ip
                port = settings.port
            
            zk = ZK(device_ip, port=port, timeout=5, password=0, force_udp=False, ommit_ping=False)
            
            logger.info(f"Attempting to connect to {device_ip}:{port}")
            
            # Connecting using executor to avoid event loop freeze
            loop = asyncio.get_running_loop()
            conn = await loop.run_in_executor(None, zk.connect)
            
            logger.info("Connected successfully! Calling on_reconnect() to sync offline records.")
            attempt = 0 # reset backoff
            
            # Update device status to online 
            async with async_session() as db:
                await crud.update_device_status(db, device_ip, online=True)
                
            # Perform offline sync right after connection
            await on_reconnect()
            
            # Start live capture. 
            # Note: pyzk conn.live_capture() yields events but is blocking!
            # We must iterate over it in an executor and pass items back via an asyncio Queue.
            queue = asyncio.Queue()
            
            def blocking_capture(q: asyncio.Queue, async_loop: asyncio.AbstractEventLoop):
                try:
                    for attendance in conn.live_capture():
                        if attendance is None: continue
                        asyncio.run_coroutine_threadsafe(q.put(attendance), async_loop)
                except Exception as ex:
                    # Capture loop broke
                    logger.error(f"Live capture error: {ex}")
                    # Put a sentinel exception to allow the async loop to know we broke
                    asyncio.run_coroutine_threadsafe(q.put(ex), async_loop)

            # Start the blocking capture in a background thread
            capture_future = loop.run_in_executor(None, blocking_capture, queue, loop)
            
            logger.info("Awaiting live punches...")
            while True:
                item = await queue.get()
                
                if isinstance(item, Exception):
                    # The capture loop threw an exception, we need to restart
                    raise item
                
                # We received a valid event
                attendance = item
                
                # Quirk: Sometimes capture yields None or malformed data depending on firmware
                if not hasattr(attendance, 'user_id'): continue
                
                # Extract event details based on pyzk Attendance object properties
                event = PunchEvent(
                    user_id=str(attendance.user_id),
                    timestamp=attendance.timestamp,
                    punch=attendance.punch,
                    status=getattr(attendance, 'status', 0),
                    verify_type=getattr(attendance, 'verify_type', getattr(attendance, 'status', 0))
                )
                
                logger.info(f"Received punch: {event.user_id} at {event.timestamp} ({event.punch})")
                
                # 1. Write to DB via crud.py
                async with async_session() as db:
                    saved_log = await crud.save_punch(db, event, device_ip)
                    
                    if saved_log:
                        # Fetch user name for the websocket payload
                        user = await crud.get_or_create_user(db, event.user_id)
                        
                        # 2. Broadcast JSON to all WebSocket clients
                        payload = {
                            "type": "live_punch",
                            "data": {
                                "user_id": event.user_id,
                                "name": user.name,
                                "timestamp": saved_log.timestamp.isoformat(),
                                "punch_type": saved_log.punch_type,
                                "verify_type": event.verify_type,
                                "sync_status": "synced"
                            }
                        }
                        await manager.broadcast(payload)
                        
        except Exception as e:
            logger.error(f"ZKTeco Connection lost or timed out: {e}")
            
            # Use fallback ip if fetch fails early
            err_ip = device_ip if 'device_ip' in locals() else "Unknown"
            
            # Mark device as offline
            async with async_session() as db:
                await crud.update_device_status(db, err_ip, online=False)
            
            # Broadcast offline state
            await manager.broadcast({
                "type": "device_status",
                "status": "reconnecting",
                "ip": err_ip
            })
            
            # Wait 10s, retry with exponential backoff, max 5 attempts
            attempt += 1
            if attempt > max_attempts:
                logger.warning("Max attempts reached, marking device definitive offline.")
                async with async_session() as db:
                    await crud.update_device_status(db, err_ip, online=False)
                await manager.broadcast({
                     "type": "device_status",
                     "status": "offline",
                     "ip": err_ip
                })
            
            # Exponential backoff base 10 seconds: 10, 20, 40, 80, 160
            sleep_time = 10 * (2 ** min(attempt - 1, 4))
            logger.info(f"Retrying connection in {sleep_time} seconds (Attempt {attempt})")
            await asyncio.sleep(sleep_time)
