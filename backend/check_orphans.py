import asyncio
from database import async_session, AttendanceLog, User
from sqlalchemy.future import select

async def check():
    async with async_session() as db:
        # Get all distinct user_ids from attendance_logs
        res_logs = await db.execute(select(AttendanceLog.user_id).distinct())
        log_ids = set(r[0] for r in res_logs.all())
        
        # Get all user_ids from users
        res_users = await db.execute(select(User.user_id))
        user_ids = set(r[0] for r in res_users.all())
        
        orphans = log_ids - user_ids
        print(f"Orphaned User IDs in Logs (in logs but not in users table): {len(orphans)}")
        if orphans:
            print(f"Example orphans: {list(orphans)[:5]}")
        
        print(f"Total Unique IDs in Logs: {len(log_ids)}")
        print(f"Total Unique IDs in Users: {len(user_ids)}")

if __name__ == "__main__":
    asyncio.run(check())
