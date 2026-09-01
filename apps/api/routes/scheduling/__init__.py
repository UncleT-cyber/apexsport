from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
import asyncio

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])

_next_run: float | None = None
_enabled = False

class ScheduleIn(BaseModel):
    enabled: bool
    interval_seconds: int = 300
    mode: str = "scheduled"  # scheduled|continuous

@router.get("/status")
def status():
    import time
    return {"enabled": _enabled, "next_run": _next_run, "now": time.time()}

@router.post("/config")
def set_config(body: ScheduleIn, background_tasks: BackgroundTasks):
    global _enabled, _next_run
    _enabled = body.enabled
    if _enabled:
        import time
        _next_run = time.time() + body.interval_seconds
        # kick off one scheduled loop in background without blocking web
        async def _loop():
            from scanner.modes.manual import run_manual_scan
            while _enabled:
                await run_manual_scan()
                await asyncio.sleep(body.interval_seconds)
        # fire and forget via background tasks not ideal for loop — use asyncio.create_task
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            loop.create_task(_loop())
        except Exception:
            pass
    else:
        _next_run = None
    return {"status": "ok", "enabled": _enabled}
