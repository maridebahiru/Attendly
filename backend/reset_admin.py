import asyncio
from database import async_session, Admin, init_db
import auth
from sqlalchemy.future import select

async def reset():
    await init_db()
    async with async_session() as db:
        result = await db.execute(select(Admin).filter(Admin.username == "admin"))
        admin = result.scalars().first()
        if not admin:
            print("Admin not found, creating...")
            hashed_pw = auth.get_password_hash("admin123")
            admin = Admin(username="admin", hashed_password=hashed_pw, role="super_admin")
            db.add(admin)
        else:
            print(f"Admin found, resetting password for {admin.username}...")
            admin.hashed_password = auth.get_password_hash("admin123")
        
        await db.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(reset())
