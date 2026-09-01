from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from backtesting.engine import replay
from backtesting.walk_forward import walk_forward
from backtesting.evaluation import evaluate_folds

router = APIRouter(prefix="/api/backtesting", tags=["backtesting"])

class BacktestIn(BaseModel):
    sport: Optional[str] = None
    market: Optional[str] = None
    min_edge: Optional[float] = None
    risk: Optional[str] = None
    min_confidence: Optional[float] = None
    results: dict[str, str] = {}  # fixture_id -> HOME/DRAW/AWAY (if empty, use stored outcomes)

def _filtered_predictions(sport: Optional[str] = None, market: Optional[str] = None, min_edge: Optional[float] = None, risk: Optional[str] = None, min_confidence: Optional[float] = None):
    # Canonical source: prediction_store (historical snapshots preserved with model_version/feature_version/prompt_version/data_snapshot_at)
    try:
        from intelligence.prediction_store import list_predictions as _lp
        preds = _lp(limit=10000, sport=sport)
    except Exception:
        from analytics.calibration.service import _predictions as _ap
        preds = [p for p in _ap if sport is None or p.get("sport") == sport]
    if market:
        preds = [p for p in preds if p.get("market") == market]
    if min_edge is not None:
        preds = [p for p in preds if (p.get("edge", 0) or 0) >= min_edge]
    if risk:
        preds = [p for p in preds if p.get("risk_level") == risk]
    if min_confidence is not None:
        preds = [p for p in preds if (p.get("confidence", 0) or 0) >= min_confidence]
    # Reproducible: sort by created_at / data_snapshot_at, not by insertion order
    preds = sorted(preds, key=lambda p: p.get("created_at") or p.get("data_snapshot_at") or "")
    return preds

def _resolve_results(sport: Optional[str], explicit: dict[str, str]) -> dict[str, str]:
    if explicit:
        return explicit
    # Use stored outcomes from analytics calibration service (fixture_id -> actual outcome)
    try:
        from analytics.calibration.service import _outcomes
        if sport:
            # filter outcomes to fixtures whose prediction matches sport
            try:
                from intelligence.prediction_store import list_predictions as _lp
                preds = _lp(limit=10000, sport=sport)
                fids = {p.get("fixture_id") for p in preds}
                return {fid: out for fid, out in _outcomes.items() if fid in fids}
            except Exception:
                return dict(_outcomes)
        return dict(_outcomes)
    except Exception:
        return {}

@router.post("/replay")
def post_replay(body: BacktestIn):
    preds = _filtered_predictions(sport=body.sport, market=body.market, min_edge=body.min_edge, risk=body.risk, min_confidence=body.min_confidence)
    results = _resolve_results(body.sport, body.results)
    if not results:
        return {"error": "no resolved outcomes available — POST /api/analytics/outcome for each fixture as results resolve (truthful incompleteness)", "prediction_count": len(preds)}
    res = replay(preds, results)
    # Enrich with config provenance
    res.update({
        "config": {"sport": body.sport, "market": body.market, "min_edge": body.min_edge, "risk": body.risk, "min_confidence": body.min_confidence},
        "predictions_evaluated": res.get("total", 0),
        "period": f"{preds[0].get('created_at','')[:10]} → {preds[-1].get('created_at','')[:10]}" if preds else None,
    })
    return res

@router.post("/walk-forward")
def post_walk(body: BacktestIn):
    preds = _filtered_predictions(sport=body.sport, market=body.market, min_edge=body.min_edge, risk=body.risk, min_confidence=body.min_confidence)
    results = _resolve_results(body.sport, body.results)
    if not results:
        return {"error": "no resolved outcomes available — POST /api/analytics/outcome as results resolve", "prediction_count": len(preds)}
    folds = walk_forward(preds, results, window=4, step=2)
    evaled = evaluate_folds(folds)
    evaled.update({"config": {"sport": body.sport, "market": body.market, "min_edge": body.min_edge, "risk": body.risk, "min_confidence": body.min_confidence}})
    return evaled

@router.get("/predictions")
def preds(sport: Optional[str]=None, market: Optional[str]=None, min_edge: Optional[float]=None, risk: Optional[str]=None):
    filtered = _filtered_predictions(sport=sport, market=market, min_edge=min_edge, risk=risk)
    return {"count": len(filtered), "predictions": filtered[-20:]}

@router.get("/config")
def config_options():
    """Expose only controls that are actually implemented."""
    return {
        "sports": ["football", "basketball"],
        "markets": {
            "football": ["MATCH_RESULT", "OVER_UNDER", "BTTS"],
            "basketball": ["MONEYLINE", "SPREAD", "TOTAL_POINTS"],
        },
        "filters": {
            "min_edge": {"type": "float", "default": 0.03, "description": "minimum edge threshold (deterministic value engine)"},
            "risk": {"type": "select", "options": ["LOW", "MEDIUM", "HIGH", "BLOCKED"], "description": "risk filter (engine assessment, not certainty)"},
            "min_confidence": {"type": "float", "default": 0.4, "description": "minimum model confidence"},
        },
        "note": "Historical Market Snapshot + Historical Feature Snapshot + Model Version + Prompt Version + Engine Configuration → Historical Prediction → Outcome → Backtest Metrics (reproducible, no future leakage). Only implemented controls are shown.",
    }

@router.post("/demo")
def demo(sport: str = "football", market: Optional[str] = None, min_edge: Optional[float] = Query(None)):
    preds = _filtered_predictions(sport=sport, market=market, min_edge=min_edge)
    if not preds:
        return {"error": f"no predictions for {sport} — run a scan first"}
    results = _resolve_results(sport, {})
    if not results:
        return {"error": "demo requires real outcome data — POST /api/analytics/outcome for each prediction as results resolve (truthful incompleteness)", "prediction_count": len(preds), "config": {"sport": sport, "market": market, "min_edge": min_edge}}
    res = replay(preds, results)
    res.update({"config": {"sport": sport, "market": market, "min_edge": min_edge}, "prediction_count": len(preds)})
    return res

@router.post("/run")
def run_backtest(
    sport: Optional[str] = None,
    market: Optional[str] = None,
    min_edge: Optional[float] = None,
    risk: Optional[str] = None,
    min_confidence: Optional[float] = None,
):
    """Unified backtest run — uses stored historical snapshots, reproducible."""
    preds = _filtered_predictions(sport=sport, market=market, min_edge=min_edge, risk=risk, min_confidence=min_confidence)
    results = _resolve_results(sport, {})
    if not preds:
        return {"error": "no predictions match filters — run a scan first or adjust filters"}
    if not results:
        return {"error": "no resolved outcomes — POST /api/analytics/outcome as fixtures resolve", "prediction_count": len(preds)}
    rep = replay(preds, results)
    folds = walk_forward(preds, results, window=4, step=2)
    evaled = evaluate_folds(folds)
    return {
        "config": {"sport": sport, "market": market, "min_edge": min_edge, "risk": risk, "min_confidence": min_confidence},
        "period": f"{preds[0].get('created_at','')[:10]} → {preds[-1].get('created_at','')[:10]}" if preds else None,
        "replay": rep,
        "walk_forward": evaled,
        "predictions_evaluated": rep.get("total", 0),
        "wins": rep.get("correct", 0),
        "hit_rate": rep.get("accuracy", 0),
        "brier": rep.get("brier"),
        "model_version": preds[0].get("model_version") if preds else None,
        "prompt_version": preds[0].get("prompt_version") if preds else None,
        "feature_version": preds[0].get("feature_version") if preds else None,
        "pipeline_version": preds[0].get("pipeline_version") if preds else None,
    }
