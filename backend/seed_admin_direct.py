import asyncio
from database import async_session, Admin, init_db
import auth

async def seed():
    await init_db()
    async with async_session() as db:
        from sqlalchemy.future import select
        result = await db.execute(select(Admin))
        if result.scalars().first():
            print("Admin already exists")
            return
        
        hashed_pw = auth.get_password_hash("admin123")
        new_admin = Admin(username="admin", hashed_password=hashed_pw, role="super_admin")
        db.add(new_admin)
        await db.commit()
        print("Super Admin created. Login with admin / admin123")

if __name__ == "__main__":
    asyncio.run(seed())
