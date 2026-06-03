import asyncio
from database import async_session, Admin
from sqlalchemy.future import select
import auth

async def verify():
    async with async_session() as db:
        result = await db.execute(select(Admin).filter(Admin.username == "admin"))
        admin = result.scalars().first()
        if not admin:
            print("Admin 'admin' not found")
            return
        
        is_correct = auth.verify_password("admin123", admin.hashed_password)
        print(f"Password 'admin123' for 'admin' is {'CORRECT' if is_correct else 'INCORRECT'}")

if __name__ == "__main__":
    asyncio.run(verify())
