"""Unified Analytics Service — consumes canonical Prediction store.

Shared data principle:
    Canonical Prediction ─┬─► UI
                         ├─► Analytics
                         ├─► Copilot
                         └─► Backtest

All metrics derived from:
  - intelligence.prediction_store (canonical predictions with full provenance)
  - analytics.calibration.service._outcomes (fixture_id → HOME/DRAW/AWAY actual outcome)

No parallel prediction DB. No fake metrics. If insufficient data: INSUFFICIENT DATA.
"""
from __future__ import annotations

from collections import defaultdict, Counter
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

# Import canonical stores (lazy to avoid circular)
def _predictions(sport: Optional[str] = None, market: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    from intelligence.prediction_store import list_predictions
    preds = list_predictions(limit=10000, sport=sport)
    if market:
        preds = [p for p in preds if p.get("market") == market]
    if limit:
        preds = preds[:limit]
    return preds

def _outcomes() -> Dict[str, str]:
    from analytics.calibration.service import _outcomes
    return _outcomes

def _resolved_pairs(sport: Optional[str] = None, market: Optional[str] = None):
    preds = _predictions(sport=sport, market=market)
    outs = _outcomes()
    pairs = []
    for p in preds:
        fid = p.get("fixture_id")
        actual = outs.get(fid)
        if actual is not None:
            pairs.append((p, actual))
    return pairs

# ─── OVERVIEW ───────────────────────────────────────────────────────────────
def overview(sport: Optional[str] = None) -> Dict[str, Any]:
    preds = _predictions(sport=sport)
    total = len(preds)
    pairs = _resolved_pairs(sport=sport)
    resolved = len(pairs)
    # hit rate
    if resolved:
        wins = sum(1 for p, actual in pairs if p.get("selection") == actual)
        hit_rate = wins / resolved
    else:
        wins = 0
        hit_rate = None
    # avg edge / odds / calibrated
    if preds:
        avg_edge = sum(p.get("edge", 0) or 0 for p in preds) / total
        avg_odds = sum(p.get("market_odds", 0) or 0 for p in preds) / total
        avg_cal = sum(p.get("calibrated_probability", 0) or 0 for p in preds) / total
    else:
        avg_edge = avg_odds = avg_cal = None
    # Brier
    brier = None
    logloss = None
    if resolved:
        try:
            from intelligence.calibration import brier_score, log_loss
            probs = [p.get("calibrated_probability", p.get("probability", 0.5)) for p, _ in pairs]
            outs = [1 if p.get("selection") == actual else 0 for p, actual in pairs]
            brier = brier_score(probs, outs)
            logloss = log_loss(probs, outs)
        except Exception:
            pass
    # yield / ROI (simple 1u stake)
    profit = None
    roi = None
    if resolved:
        profit = 0.0
        for p, actual in pairs:
            odds = p.get("market_odds", 0) or 0
            if p.get("selection") == actual:
                profit += (odds - 1)
            else:
                profit += -1
        roi = profit / resolved if resolved else None
    # active sports
    try:
        from intelligence.prediction_store import list_predictions as lp
        all_preds = lp(limit=10000, sport=None)
        sports = sorted(set(p.get("sport") for p in all_preds if p.get("sport")))
    except Exception:
        sports = []
    # volume per sport (last 30 days? simple total)
    volume_by_sport = dict(Counter(p.get("sport", "unknown") for p in preds))

    return {
        "sport": sport or "all",
        "total_predictions": total,
        "resolved": resolved,
        "unresolved": total - resolved,
        "wins": wins,
        "hit_rate": round(hit_rate, 4) if hit_rate is not None else None,
        "avg_edge": round(avg_edge, 4) if avg_edge is not None else None,
        "avg_odds": round(avg_odds, 2) if avg_odds is not None else None,
        "avg_calibrated": round(avg_cal, 4) if avg_cal is not None else None,
        "brier_score": round(brier, 4) if brier is not None else None,
        "log_loss": round(logloss, 4) if logloss is not None else None,
        "profit": round(profit, 2) if profit is not None else None,
        "roi": round(roi, 4) if roi is not None else None,
        "yield_": round(roi, 4) if roi is not None else None,  # alias
        "active_sports": sports,
        "volume_by_sport": volume_by_sport,
        "calibration_status": "ACTIVE" if resolved >= 20 else "INSUFFICIENT DATA",
    }

# ─── VALUE ANALYTICS (edge bands) ─────────────────────────────────────────
EDGE_BANDS = [
    ("< 0%", lambda e: e < 0),
    ("0–2%", lambda e: 0 <= e < 0.02),
    ("2–5%", lambda e: 0.02 <= e < 0.05),
    ("5–10%", lambda e: 0.05 <= e < 0.10),
    ("10%+", lambda e: e >= 0.10),
]

def value_analytics(sport: Optional[str] = None) -> Dict[str, Any]:
    preds = _predictions(sport=sport)
    outs = _outcomes()
    bands = []
    for label, fn in EDGE_BANDS:
        band_preds = [p for p in preds if fn(p.get("edge", 0) or 0)]
        count = len(band_preds)
        avg_edge = sum(p.get("edge", 0) or 0 for p in band_preds) / count if count else None
        # resolved in band
        resolved = [(p, outs.get(p.get("fixture_id"))) for p in band_preds]
        resolved = [(p, a) for p, a in resolved if a is not None]
        if resolved:
            wins = sum(1 for p, a in resolved if p.get("selection") == a)
            hit = wins / len(resolved)
            # ROI in band
            profit = sum((p.get("market_odds", 0) - 1) if p.get("selection") == a else -1 for p, a in resolved)
            roi = profit / len(resolved)
        else:
            hit = None
            roi = None
        bands.append({
            "band": label,
            "count": count,
            "avg_edge": round(avg_edge, 4) if avg_edge is not None else None,
            "resolved": len(resolved),
            "hit_rate": round(hit, 4) if hit is not None else None,
            "roi": round(roi, 4) if roi is not None else None,
        })
    return {"sport": sport or "all", "bands": bands, "total": len(preds)}

# ─── RISK ANALYTICS ───────────────────────────────────────────────────────
def risk_analytics(sport: Optional[str] = None) -> Dict[str, Any]:
    preds = _predictions(sport=sport)
    outs = _outcomes()
    levels = ["LOW", "MEDIUM", "HIGH", "BLOCKED"]
    rows = []
    for lvl in levels:
        lvl_preds = [p for p in preds if p.get("risk_level") == lvl]
        count = len(lvl_preds)
        resolved = [(p, outs.get(p.get("fixture_id"))) for p in lvl_preds]
        resolved = [(p, a) for p, a in resolved if a is not None]
        if resolved:
            wins = sum(1 for p, a in resolved if p.get("selection") == a)
            hit = wins / len(resolved)
        else:
            hit = None
        rows.append({
            "risk": lvl,
            "count": count,
            "resolved": len(resolved),
            "hit_rate": round(hit, 4) if hit is not None else None,
        })
    return {"sport": sport or "all", "by_risk": rows, "total": len(preds)}

# ─── SPORT COMPARISON ─────────────────────────────────────────────────────
def sport_comparison() -> Dict[str, Any]:
    try:
        from intelligence.prediction_store import list_predictions as lp
        all_preds = lp(limit=10000, sport=None)
    except Exception:
        all_preds = []
    sports = sorted(set(p.get("sport") for p in all_preds if p.get("sport")))
    # fallback to overview per sport
    by_sport = {}
    for s in sports:
        by_sport[s] = overview(sport=s)
    # also totals
    by_sport["all"] = overview(sport=None)
    return {"sports": sports, "by_sport": by_sport}

# ─── MODEL / SPECIALIST PERFORMANCE ───────────────────────────────────────
def model_performance(sport: Optional[str] = None) -> Dict[str, Any]:
    preds = _predictions(sport=sport)
    outs = _outcomes()
    # specialists seen
    specialists = set()
    model_versions = Counter()
    prompt_versions = Counter()
    failures = 0
    disagreements = []
    for p in preds:
        for s in p.get("specialist_outputs", []):
            specialists.add(s.get("specialist_id"))
            model_versions[s.get("model", "unknown")] += 1
            prompt_versions[s.get("prompt_version", "unknown")] += 1
            if s.get("model_metadata", {}).get("is_stub"):
                failures += 1
        if p.get("ensemble", {}).get("disagreement") is not None:
            disagreements.append(p["ensemble"]["disagreement"])
    avg_disagreement = sum(disagreements)/len(disagreements) if disagreements else None
    # hit rate where resolved (ensemble level)
    pairs = [(p, outs.get(p.get("fixture_id"))) for p in preds]
    pairs = [(p, a) for p, a in pairs if a is not None]
    if pairs:
        wins = sum(1 for p, a in pairs if p.get("selection") == a)
        hit = wins / len(pairs)
    else:
        hit = None
    return {
        "sport": sport or "all",
        "total_predictions": len(preds),
        "resolved": len(pairs),
        "hit_rate": round(hit, 4) if hit is not None else None,
        "specialists": sorted(specialists),
        "model_versions": dict(model_versions),
        "prompt_versions": dict(prompt_versions),
        "failure_rate": round(failures / max(1, len(preds)*6), 4) if preds else None,
        "avg_disagreement": round(avg_disagreement, 4) if avg_disagreement is not None else None,
        "note": "Per-specialist hit rate requires per-specialist outcome attribution which is not yet fully tracked; showing ensemble-level hit rate and disagreement/failure only. Do not claim individual specialist accuracy without attribution data." if not pairs else "Ensemble hit rate shown; per-specialist accuracy would require per-specialist selection vs outcome, not yet attributed.",
    }

# ─── PREDICTION PERFORMANCE (filtered) ────────────────────────────────────
def prediction_performance(
    sport: Optional[str] = None,
    market: Optional[str] = None,
    risk: Optional[str] = None,
    min_edge: Optional[float] = None,
    min_confidence: Optional[float] = None,
    model_version: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    preds = _predictions(sport=sport, market=market)
    # additional filters
    if risk:
        preds = [p for p in preds if p.get("risk_level") == risk]
    if min_edge is not None:
        preds = [p for p in preds if (p.get("edge", 0) or 0) >= min_edge]
    if min_confidence is not None:
        preds = [p for p in preds if (p.get("confidence", 0) or 0) >= min_confidence]
    if model_version:
        preds = [p for p in preds if p.get("model_used") == model_version or model_version in str(p.get("prompt_versions", {}))]
    preds = preds[:limit]
    outs = _outcomes()
    # compute metrics on filtered set
    resolved = [(p, outs.get(p.get("fixture_id"))) for p in preds]
    resolved = [(p, a) for p, a in resolved if a is not None]
    if resolved:
        wins = sum(1 for p, a in resolved if p.get("selection") == a)
        hit = wins / len(resolved)
        profit = sum((p.get("market_odds", 0)-1) if p.get("selection")==a else -1 for p,a in resolved)
        roi = profit / len(resolved)
    else:
        hit = roi = profit = None
        wins = 0
    return {
        "filters": {"sport": sport, "market": market, "risk": risk, "min_edge": min_edge, "min_confidence": min_confidence, "model_version": model_version},
        "total": len(preds),
        "resolved": len(resolved),
        "wins": wins,
        "hit_rate": round(hit, 4) if hit is not None else None,
        "profit": round(profit, 2) if profit is not None else None,
        "roi": round(roi, 4) if roi is not None else None,
        "predictions": preds,
    }
