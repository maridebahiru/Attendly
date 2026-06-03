import asyncio
from database import async_session
import crud

async def check():
    async with async_session() as db:
        status = await crud.get_device_status(db, "192.168.10.40")
        if status:
            print(f"Device IP: {status.ip}")
            print(f"Status: {status.status}")
            print(f"Last Ping: {status.last_ping}")
        else:
            print("No status found for 192.168.10.40")

if __name__ == "__main__":
    asyncio.run(check())
