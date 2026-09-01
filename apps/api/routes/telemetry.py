from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Any

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])

# In-memory telemetry buffer (like ApexLoop signal_store history)
_events: list[dict] = []
_MAX = 500

class TelemetryEvent(BaseModel):
    event: str
    prediction_id: Optional[str] = None
    fixture_id: Optional[str] = None
    sport: Optional[str] = None
    slip_id: Optional[str] = None
    data: Optional[Any] = None

@router.post("/slip")
def post_slip_telemetry(evt: TelemetryEvent):
    import time
    rec = {"timestamp": time.time(), **evt.model_dump()}
    _events.append(rec)
    if len(_events) > _MAX:
        _events[:] = _events[-_MAX:]
    # Also mirror to scanner state for observability
    try:
        from scanner.pipeline.state import get_scanner_state
        st = get_scanner_state()
        msg = evt.event
        if evt.prediction_id:
            msg += f" {evt.prediction_id[:12]}"
        st._add_event("SLIP", msg, evt.fixture_id, "INFO")
    except Exception:
        pass
    return {"ok": True, "event": evt.event}

@router.get("/slip")
def list_telemetry(limit: int = 50):
    return {"events": _events[-limit:], "total": len(_events)}

@router.delete("/slip")
def clear_telemetry():
    _events.clear()
    return {"cleared": True}
