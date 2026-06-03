import asyncio
from database import async_session, AttendanceLog
from sqlalchemy.future import select
from datetime import date

async def check():
    async with async_session() as db:
        today = date.today()
        # Filter logs by today's date (ignoring time)
        stmt = select(AttendanceLog).filter(AttendanceLog.timestamp >= today)
        res = await db.execute(stmt)
        logs = res.scalars().all()
        print(f"Today's logs ({today}): {len(logs)}")
        for log in logs:
            print(f" - User {log.user_id} at {log.timestamp}")

if __name__ == "__main__":
    asyncio.run(check())
