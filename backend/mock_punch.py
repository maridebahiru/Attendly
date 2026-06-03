import asyncio
import datetime
from database import async_session, AttendanceLog
import schemas
from websocket_manager import manager

async def mock_punch():
    async with async_session() as db:
        # Create a mock punch for today for a known user (id 12)
        event = schemas.PunchEvent(
            user_id="12",
            timestamp=datetime.datetime.now(),
            punch=0, # IN
            status=0,
            verify_type=1
        )
        
        # Save to DB
        from crud import save_punch
        log = await save_punch(db, event, "127.0.0.1")
        
        if log:
            print(f"Mock punch saved: {log.id}")
            # Broadcast to UI
            # (Note: In a real script we'd need to be part of the running app process to use manager.broadcast,
            # but here we can just verify it's in the DB and then the user can refresh)
            print("Punch saved to DB for today. Please refresh your dashboard.")
        else:
            print("Failed to save punch (maybe duplicate)")

if __name__ == "__main__":
    asyncio.run(mock_punch())
