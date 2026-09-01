from __future__ import annotations
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from analytics.calibration.service import calibration_report, record_outcome

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/calibration")
def get_calibration(sport: Optional[str] = None):
    return calibration_report(sport=sport)

class OutcomeIn(BaseModel):
    fixture_id: str
    outcome: str  # HOME/DRAW/AWAY

@router.post("/outcome")
def post_outcome(body: OutcomeIn):
    record_outcome(body.fixture_id, body.outcome)
    return {"status": "ok", "fixture_id": body.fixture_id}

@router.get("/predictions")
def list_predictions(sport: Optional[str] = None, limit: int = 50):
    from analytics.calibration.service import _predictions
    # Legacy mirror; prefer canonical store but keep compat
    try:
        from intelligence.prediction_store import list_predictions as _lp
        preds = _lp(limit=10000, sport=sport)
        return {"predictions": preds[-limit:], "total": len(preds)}
    except Exception:
        filtered = [p for p in _predictions if sport is None or p.get("sport")==sport]
        return {"predictions": filtered[-limit:], "total": len(filtered)}

@router.get("/overview")
def overview(sport: Optional[str] = None):
    from analytics.service import overview as _ov
    return _ov(sport=sport)

@router.get("/value")
def value_analytics(sport: Optional[str] = None):
    from analytics.service import value_analytics as _va
    return _va(sport=sport)

@router.get("/risk")
def risk_analytics(sport: Optional[str] = None):
    from analytics.service import risk_analytics as _ra
    return _ra(sport=sport)

@router.get("/sport-comparison")
def sport_comparison():
    from analytics.service import sport_comparison as _sc
    return _sc()

@router.get("/models")
def model_performance(sport: Optional[str] = None):
    from analytics.service import model_performance as _mp
    return _mp(sport=sport)

@router.get("/performance")
def performance(
    sport: Optional[str] = None,
    market: Optional[str] = None,
    risk: Optional[str] = None,
    min_edge: Optional[float] = None,
    min_confidence: Optional[float] = None,
    model_version: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
):
    from analytics.service import prediction_performance as _pp
    return _pp(sport=sport, market=market, risk=risk, min_edge=min_edge, min_confidence=min_confidence, model_version=model_version, limit=limit)

@router.get("/engine-status")
def engine_status():
    try:
        from intelligence.brain import get_brain_status
        brain = get_brain_status()
    except Exception as e:
        brain = {"error": str(e)}
    try:
        from intelligence.prediction_store import list_predictions as _lp
        total = len(_lp(limit=10000))
    except Exception:
        total = 0
    try:
        from analytics.calibration.service import _outcomes
        resolved = len(_outcomes)
    except Exception:
        resolved = 0
    return {"brain": brain, "total_predictions": total, "resolved_outcomes": resolved}
