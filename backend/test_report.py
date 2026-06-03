import asyncio
import json
from database import async_session
from crud import get_attendance_report
from datetime import date

async def test():
    async with async_session() as db:
        # Test for today
        from sqlalchemy import select
        from database import AttendanceLog
        from datetime import datetime, time
        start = datetime.combine(date(2026, 5, 7), time.min)
        end = datetime.combine(date(2026, 5, 7), time.max)
        
        q = select(AttendanceLog).filter(AttendanceLog.timestamp >= start, AttendanceLog.timestamp <= end)
        res = await db.execute(q)
        logs = res.scalars().all()
        print(f"Total logs found in DB for 2026-05-07: {len(logs)}")
        for l in logs:
            print(f"Log: {l.user_id} at {l.timestamp}")

        report = await get_attendance_report(db, target_date=date(2026, 5, 7))

        users_with_punches = [u for u in report if u['punches']]
        if users_with_punches:
            for u in users_with_punches:
                print(f"User: {u['name']} ({u['user_id']})")
                print(json.dumps(u['punches'], indent=2))
        else:
            print("No users with punches found for 2026-05-07")


if __name__ == "__main__":
    asyncio.run(test())
