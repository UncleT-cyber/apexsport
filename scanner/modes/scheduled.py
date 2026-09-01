"""Scheduled scans."""
import asyncio
from scanner.modes.manual import run_manual_scan

async def scheduled_loop(interval_seconds: int = 300):
    while True:
        try:
            await run_manual_scan()
        except Exception:
            pass
        await asyncio.sleep(interval_seconds)
