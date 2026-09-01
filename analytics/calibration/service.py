"""Calibration at scale — buckets, curves, Brier/log loss, reliability.

Every prediction retains model_version, feature_version, prompt_version, data_snapshot, timestamp for reproducibility.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional
from intelligence.calibration import brier_score, log_loss

BUCKETS = ["0.0-0.1","0.1-0.2","0.2-0.3","0.3-0.4","0.4-0.5","0.5-0.6","0.6-0.7","0.7-0.8","0.8-0.9","0.9-1.0"]

def bucket_for_prob(p: float) -> str:
    idx = min(9, max(0, int(p*10)))
    return BUCKETS[idx]

# In-memory store for demo — in production backs CalibrationBucket table + PredictionRecord
_predictions: list[dict] = []
_outcomes: dict[str, str] = {}  # fixture_id -> actual outcome HOME/DRAW/AWAY

def record_prediction(pred: dict) -> None:
    pred = {**pred, "created_at": datetime.now(timezone.utc).isoformat()}
    _predictions.append(pred)

def record_outcome(fixture_id: str, outcome: str) -> None:
    _outcomes[fixture_id] = outcome

def calibration_report(sport: Optional[str] = None) -> dict:
    # Canonical source is prediction_store; _predictions is legacy mirror kept for compat.
    try:
        from intelligence.prediction_store import list_predictions as _lp
        canonical = _lp(limit=10000, sport=sport)
        # Merge with legacy _predictions, dedup by id
        seen = {p.get("id") for p in canonical}
        for p in _predictions:
            if p.get("id") not in seen and (sport is None or p.get("sport") == sport):
                canonical.append(p)
        filtered = canonical
    except Exception:
        filtered = [p for p in _predictions if (sport is None or p.get("sport") == sport)]
    buckets: dict[str, list[dict]] = defaultdict(list)
    for p in filtered:
        cp = p.get("calibrated_probability") or p.get("probability", 0.5)
        buckets[bucket_for_prob(cp)].append(p)

    curve = []
    all_probs: list[float] = []
    all_outcomes: list[int] = []
    for b in BUCKETS:
        items = buckets.get(b, [])
        if not items:
            curve.append({"bucket": b, "predicted_rate": float(b.split("-")[0]), "actual_rate": None, "count": 0, "brier": None})
            continue
        probs = [x.get("calibrated_probability") or x.get("probability",0.5) for x in items]
        # actual outcomes only where known
        known = [(p, _outcomes.get(p["fixture_id"])) for p in items]
        known = [(p, o) for p, o in known if o is not None]
        if known:
            outcomes = [1 if p["selection"] == o else 0 for p, o in known]
            probs_known = [p.get("calibrated_probability") or p.get("probability",0.5) for p, o in known]
            brier = brier_score(probs_known, outcomes)
            actual_rate = sum(outcomes)/len(outcomes) if outcomes else None
            all_probs.extend(probs_known)
            all_outcomes.extend(outcomes)
        else:
            brier = None
            actual_rate = None
        pred_rate = sum(probs)/len(probs) if probs else 0
        curve.append({"bucket": b, "predicted_rate": round(pred_rate,3), "actual_rate": actual_rate, "count": len(items), "brier": round(brier,4) if brier is not None else None})

    overall_brier = brier_score(all_probs, all_outcomes) if all_probs else None
    overall_logloss = log_loss(all_probs, all_outcomes) if all_probs else None
    return {
        "sport": sport or "all",
        "total_predictions": len(filtered),
        "resolved": len(all_probs),
        "brier_score": round(overall_brier,4) if overall_brier is not None else None,
        "log_loss": round(overall_logloss,4) if overall_logloss is not None else None,
        "curve": curve,
        "reliability": curve,  # alias
    }

def clear():
    _predictions.clear()
    _outcomes.clear()
