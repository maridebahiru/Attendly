import asyncio
from database import async_session, Admin
from sqlalchemy.future import select

async def check_admins():
    async with async_session() as db:
        result = await db.execute(select(Admin))
        admins = result.scalars().all()
        for admin in admins:
            print(f"ID: {admin.id}, Username: {admin.username}, Role: {admin.role}")

if __name__ == "__main__":
    asyncio.run(check_admins())
