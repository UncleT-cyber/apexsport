"""Continuous background intelligence."""
import asyncio
from scanner.modes.manual import run_manual_scan
async def continuous_loop(poll_seconds: int = 60):
    while True:
        await run_manual_scan()
        await asyncio.sleep(poll_seconds)
