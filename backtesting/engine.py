"""Backtesting — replay with point-in-time data, no future leakage."""
from __future__ import annotations
from datetime import datetime, timezone
from intelligence.calibration import brier_score

def replay(predictions: list[dict], results: dict[str, str]) -> dict:
    """results: fixture_id -> HOME/DRAW/AWAY actual outcome."""
    probs: list[float] = []
    outcomes: list[int] = []
    correct = 0
    for p in predictions:
        fid = p["fixture_id"]
        actual = results.get(fid)
        if not actual:
            continue
        probs.append(p.get("calibrated_probability", p.get("probability", 0.5)))
        outcomes.append(1 if p["selection"] == actual else 0)
        if p["selection"] == actual:
            correct += 1
    total = len(probs)
    return {
        "total": total,
        "correct": correct,
        "accuracy": correct/total if total else 0,
        "brier": brier_score(probs, outcomes),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
