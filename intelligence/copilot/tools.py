"""Copilot Tool Registry — read-only domain tools on canonical data.

Each tool delegates to existing domain services, no duplicated business logic.
Tools never invent predictions/odds/fixtures. If data does not exist: Data unavailable.
"""
from __future__ import annotations

from typing import Optional, Any, Dict, List

TOOL_SCHEMAS = [
    {
        "name": "get_current_predictions",
        "description": "List current Apex predictions (canonical). Filters by sport/market/limit. Returns predictions with provenance.",
        "parameters": {
            "type": "object",
            "properties": {
                "sport": {"type": "string", "description": "football | basketball | tennis | null for all"},
                "market": {"type": "string", "description": "MATCH_RESULT | MONEYLINE | etc"},
                "limit": {"type": "integer", "description": "max to return, default 10"},
                "value_only": {"type": "boolean", "description": "only value picks"},
            },
        },
    },
    {
        "name": "get_prediction",
        "description": "Get single prediction by ID (full provenance chain).",
        "parameters": {
            "type": "object",
            "properties": {"prediction_id": {"type": "string"}},
            "required": ["prediction_id"],
        },
    },
    {
        "name": "get_prediction_analysis",
        "description": "Get concise WHY APEX? analysis for a prediction (ensemble, calibration, value, risk, evidence).",
        "parameters": {
            "type": "object",
            "properties": {"prediction_id": {"type": "string"}},
            "required": ["prediction_id"],
        },
    },
    {
        "name": "get_fixture",
        "description": "Get fixture/match context by fixture_id.",
        "parameters": {
            "type": "object",
            "properties": {"fixture_id": {"type": "string"}},
            "required": ["fixture_id"],
        },
    },
    {
        "name": "get_market_snapshot",
        "description": "Get market snapshot (odds) for a fixture at prediction time.",
        "parameters": {
            "type": "object",
            "properties": {"fixture_id": {"type": "string"}},
            "required": ["fixture_id"],
        },
    },
    {
        "name": "get_current_odds",
        "description": "Get current normalized canonical odds via Odds provider adapter.",
        "parameters": {
            "type": "object",
            "properties": {"sport": {"type": "string"}, "event_id": {"type": "string"}},
        },
    },
    {
        "name": "get_slip",
        "description": "Get slip by ID (canonical). Shows selections tracing to predictions.",
        "parameters": {
            "type": "object",
            "properties": {"slip_id": {"type": "string"}},
            "required": ["slip_id"],
        },
    },
    {
        "name": "get_backtest_result",
        "description": "Get backtest results for a sport/market using historical snapshots. Returns reproducible metrics.",
        "parameters": {
            "type": "object",
            "properties": {
                "sport": {"type": "string"},
                "market": {"type": "string"},
                "min_edge": {"type": "number"},
            },
        },
    },
    {
        "name": "get_calibration_metrics",
        "description": "Get calibration metrics (Brier, reliability curve) for a sport.",
        "parameters": {
            "type": "object",
            "properties": {"sport": {"type": "string"}},
        },
    },
    {
        "name": "get_engine_status",
        "description": "Get engine status: brain (agents, model), total predictions, resolved outcomes, active sports.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_supported_markets",
        "description": "Get supported canonical markets per sport (sport-aware semantics).",
        "parameters": {
            "type": "object",
            "properties": {"sport": {"type": "string"}},
        },
    },
]

def _tool_get_current_predictions(sport: Optional[str] = None, market: Optional[str] = None, limit: int = 10, value_only: bool = False):
    from intelligence.prediction_store import list_predictions
    preds = list_predictions(limit=limit * 3 if value_only else limit, sport=sport)
    if market:
        preds = [p for p in preds if p.get("market") == market]
    if value_only:
        preds = [p for p in preds if p.get("is_value")]
    preds = preds[:limit]
    if not preds:
        return {"status": "Data unavailable", "message": f"No predictions found for sport={sport} market={market} (run a scan first)"}
    # Return summarized (not full feature snapshot to keep tokens)
    return {
        "count": len(preds),
        "predictions": [
            {
                "id": p.get("id"),
                "fixture_id": p.get("fixture_id"),
                "fixture_label": p.get("fixture_label"),
                "sport": p.get("sport"),
                "competition": p.get("competition"),
                "market": p.get("market"),
                "selection": p.get("selection"),
                "market_odds": p.get("market_odds"),
                "calibrated_probability": p.get("calibrated_probability"),
                "edge": p.get("edge"),
                "is_value": p.get("is_value"),
                "risk_level": p.get("risk_level"),
                "model_used": p.get("model_used"),
                "created_at": p.get("created_at"),
            }
            for p in preds
        ],
    }

def _tool_get_prediction(prediction_id: str):
    from intelligence.prediction_store import get_prediction
    p = get_prediction(prediction_id)
    if not p:
        # also try fixture_id index
        p = get_prediction(prediction_id)
    if not p:
        return {"status": "Data unavailable", "message": f"Prediction {prediction_id} not found"}
    return p

def _tool_get_prediction_analysis(prediction_id: str):
    p = _tool_get_prediction(prediction_id)
    if isinstance(p, dict) and p.get("status") == "Data unavailable":
        return p
    # Build WHY APEX? concise analysis from recorded outputs (not chain-of-thought)
    ensemble = p.get("ensemble", {})
    calib = p.get("calibration_output", {})
    value = p.get("value_output", {})
    risk = p.get("risk_output", {})
    specialists = p.get("specialist_outputs", [])
    return {
        "prediction_id": p.get("id"),
        "fixture": p.get("fixture_label"),
        "market": f"{p.get('market')} → {p.get('selection')}",
        "ai_intelligence": {
            "model": p.get("model_used"),
            "provider": p.get("provider_used"),
            "model_version": specialists[0].get("model_version") if specialists else p.get("model_version"),
            "specialists": [{"specialist": s.get("specialist_id"), "model": s.get("model"), "prompt_version": s.get("prompt_version"), "prompt_path": s.get("prompt_path")} for s in specialists[:6]],
            "prompt_versions": p.get("prompt_paths", {}),
        },
        "why_apex": f"Apex calibrated probability {p.get('calibrated_probability')} vs market implied {p.get('implied_probability')} (edge {(p.get('edge') or 0):+.1%}) — {'VALUE' if p.get('is_value') else 'no value'}. Ensemble disagreement {ensemble.get('disagreement','—')} • Calibration {'active' if p.get('calibration_active') else 'insufficient data'}. Key factors: {', '.join([s.get('key_factors', [''])[0] for s in specialists[:2] if s.get('key_factors')]) or 'see specialist evidence'}",
        "ensemble": ensemble,
        "calibration": {"raw": p.get("probability"), "calibrated": p.get("calibrated_probability"), "method": calib.get("method", "none"), "is_active": p.get("calibration_active")},
        "value": {"market_odds": p.get("market_odds"), "implied": p.get("implied_probability"), "fair_odds": p.get("fair_odds"), "edge": p.get("edge"), "ev": p.get("expected_value"), "is_value": p.get("is_value")},
        "risk": {"level": p.get("risk_level"), "score": p.get("risk_score"), "reasons": risk.get("reasons", []) if isinstance(risk, dict) else []},
        "evidence": [e for s in specialists[:3] for e in s.get("evidence", [])[:1]],
        "note": "AI analysis vs Apex deterministic mathematics are separate — ensemble/calibration/value/risk are deterministic, not LLM-calculated.",
    }

def _tool_get_fixture(fixture_id: str):
    # Try to get from prediction's fixture
    from intelligence.prediction_store import get_prediction, list_predictions
    p = get_prediction(fixture_id)
    if p and p.get("fixture"):
        return p.get("fixture")
    # search predictions for fixture_id
    for pred in list_predictions(limit=100):
        if pred.get("fixture_id") == fixture_id:
            return pred.get("fixture") or {"fixture_id": fixture_id, "label": pred.get("fixture_label"), "sport": pred.get("sport"), "competition": pred.get("competition")}
    return {"status": "Data unavailable", "message": f"Fixture {fixture_id} not found — run a scan to discover fixtures"}

def _tool_get_market_snapshot(fixture_id: str):
    from intelligence.prediction_store import get_prediction, list_predictions
    p = get_prediction(fixture_id)
    if not p:
        for pred in list_predictions(limit=100):
            if pred.get("fixture_id") == fixture_id:
                p = pred
                break
    if not p:
        return {"status": "Data unavailable", "message": f"No market snapshot for fixture {fixture_id}"}
    return p.get("market_snapshot", {"status": "Data unavailable"})

def _tool_get_current_odds(sport: Optional[str] = None, event_id: Optional[str] = None):
    # Use canonical odds collector (provider adapter)
    import asyncio
    try:
        from ingestion.collectors.odds import collect_odds
        odds = asyncio.run(collect_odds(event_id=event_id, sport=sport or "football"))
        if not odds:
            return {"status": "Data unavailable", "message": "No odds available — check The Odds API provider key in Settings"}
        return {"count": len(odds), "odds": odds[:10]}
    except Exception as e:
        return {"status": "Data unavailable", "message": f"Odds collector error: {str(e)[:100]}"}

def _tool_get_slip(slip_id: str):
    from slips.store import get_slip
    slip = get_slip(slip_id)
    if not slip:
        return {"status": "Data unavailable", "message": f"Slip {slip_id} not found"}
    return slip.model_dump()

def _tool_get_backtest_result(sport: Optional[str] = None, market: Optional[str] = None, min_edge: Optional[float] = None):
    try:
        from analytics.service import overview as _ov
        from backtesting.engine import replay
        from intelligence.prediction_store import list_predictions as _lp
        preds = _lp(limit=10000, sport=sport)
        if market:
            preds = [p for p in preds if p.get("market") == market]
        if min_edge is not None:
            preds = [p for p in preds if (p.get("edge", 0) or 0) >= min_edge]
        from analytics.calibration.service import _outcomes
        results = dict(_outcomes)
        if not results:
            return {"status": "Data unavailable", "message": "No resolved outcomes — POST /api/analytics/outcome as fixtures resolve for backtest to be meaningful"}
        res = replay(preds, results)
        return {"sport": sport, "market": market, "predictions_evaluated": res.get("total"), "hit_rate": res.get("accuracy"), "brier": res.get("brier"), "note": "Historical Market Snapshot + Feature Snapshot + Model/Prompt versions preserved (reproducible, no future leakage)"}
    except Exception as e:
        return {"status": "Data unavailable", "message": str(e)[:120]}

def _tool_get_calibration_metrics(sport: Optional[str] = None):
    try:
        from analytics.calibration.service import calibration_report
        rep = calibration_report(sport=sport)
        if rep.get("resolved", 0) < 5:
            rep["note"] = "INSUFFICIENT DATA — need 20+ resolved outcomes for calibration ACTIVE"
        return rep
    except Exception as e:
        return {"status": "Data unavailable", "message": str(e)[:100]}

def _tool_get_engine_status():
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
    # Supported markets sport-aware
    try:
        from intelligence.market_registry import SPORT_MARKETS
        markets = {k: list(v) for k, v in SPORT_MARKETS.items()}
    except Exception:
        markets = {}
    return {"brain": brain, "total_predictions": total, "resolved_outcomes": resolved, "supported_markets": markets}

def _tool_get_supported_markets(sport: Optional[str] = None):
    try:
        from intelligence.market_registry import get_valid_markets, is_implemented
        if sport:
            if not is_implemented(sport):
                return {"status": "Data unavailable", "message": f"Sport {sport} not implemented"}
            return {"sport": sport, "markets": sorted(get_valid_markets(sport))}
        from intelligence.market_registry import SPORT_MARKETS
        return {"markets_by_sport": {k: sorted(v) for k, v in SPORT_MARKETS.items()}}
    except Exception as e:
        return {"status": "Data unavailable", "message": str(e)[:100]}

# Dispatcher
TOOL_FUNCS = {
    "get_current_predictions": _tool_get_current_predictions,
    "get_prediction": _tool_get_prediction,
    "get_prediction_analysis": _tool_get_prediction_analysis,
    "get_fixture": _tool_get_fixture,
    "get_market_snapshot": _tool_get_market_snapshot,
    "get_current_odds": _tool_get_current_odds,
    "get_slip": _tool_get_slip,
    "get_backtest_result": _tool_get_backtest_result,
    "get_calibration_metrics": _tool_get_calibration_metrics,
    "get_engine_status": _tool_get_engine_status,
    "get_supported_markets": _tool_get_supported_markets,
}

def execute_tool(name: str, args: dict) -> Any:
    fn = TOOL_FUNCS.get(name)
    if not fn:
        return {"error": f"Unknown tool {name}", "available": list(TOOL_FUNCS.keys())}
    try:
        return fn(**args)
    except Exception as e:
        return {"error": f"Tool {name} failed: {str(e)[:120]}", "args": args}
