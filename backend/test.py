import asyncio
from database import async_session
import crud
import json

async def main():
    async with async_session() as db:
        report = await crud.get_attendance_report(db)
        for r in report:
            print(f"User: {r['name']}")
            for p in r['punches']:
                print(f"  Punch: {p['time']} - {p['type']} - {p['label']}")

asyncio.run(main())
