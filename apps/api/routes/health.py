from fastapi import APIRouter
from datetime import datetime, timezone
from scanner.pipeline.state import get_scanner_state

router = APIRouter()

@router.get("/health")
def health():
    state = get_scanner_state()
    snap = state.get_snapshot()
    return {
        "status": "ok",
        "service": "apexsport",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": {
            "scanner_state": snap.state,
            "is_scanning": snap.is_scanning,
            "fixtures_total": snap.fixtures_total,
            "fixtures_completed": snap.fixtures_completed,
            "predictions_generated": snap.predictions_generated,
            "total_predictions": snap.total_predictions,
            "recent_predictions": len(snap.recent_predictions),
            "events": len(snap.events),
            "pipeline_stages": len(snap.pipeline_stages),
        },
        "endpoints": {
            "scanner": "/api/scanner/state",
            "predictions": "/api/predictions",
            "slips": "/api/slips",
            "brain": "/api/brain/status",
            "calibration": "/api/analytics/calibration",
            "backtest": "/api/backtesting/predictions",
        },
    }

@router.get("/api/health")
def api_health():
    return {"status": "ok", "service": "apexsport"}
