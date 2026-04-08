import asyncio
from database import async_session, User, AttendanceLog
from sqlalchemy.future import select

async def check():
    async with async_session() as db:
        users = await db.execute(select(User))
        logs = await db.execute(select(AttendanceLog))
        print(f"Users: {len(users.scalars().all())}")
        print(f"Logs: {len(logs.scalars().all())}")

if __name__ == "__main__":
    asyncio.run(check())
