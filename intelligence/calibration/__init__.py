"""Calibration — distinct from confidence. Raw vs calibrated, with is_active and no fake Brier.

Calibration is its own stage: raw_probability (ensemble) → calibrated_probability (via historical buckets).
If insufficient historical data, is_active=False and calibrated == raw.
"""
from __future__ import annotations
import math
from typing import Optional
from intelligence.contracts import CalibrationOutput

# Minimum resolved predictions to activate calibration
MIN_RESOLVED_FOR_CALIBRATION = 20
MIN_PER_BUCKET = 5

def brier_score(probs: list[float], outcomes: list[int]) -> float:
    n = len(probs)
    if n == 0:
        return 0.0
    return sum((p - o) ** 2 for p, o in zip(probs, outcomes)) / n

def log_loss(probs: list[float], outcomes: list[int], eps: float = 1e-15) -> float:
    total = 0.0
    for p, o in zip(probs, outcomes):
        p = min(max(p, eps), 1 - eps)
        total += -(o * math.log(p) + (1 - o) * math.log(1 - p))
    return total / len(probs) if probs else 0.0

def _bucket_for_prob(p: float) -> str:
    idx = min(9, max(0, int(p * 10)))
    buckets = ["0.0-0.1","0.1-0.2","0.2-0.3","0.3-0.4","0.4-0.5","0.5-0.6","0.6-0.7","0.7-0.8","0.8-0.9","0.9-1.0"]
    return buckets[idx]

def calibrate(raw_prob: float, sport: Optional[str] = None) -> CalibrationOutput:
    """Calibrate raw ensemble probability.

    Returns CalibrationOutput with is_active flag. Never fabricates Brier.
    """
    from analytics.calibration.service import calibration_report

    # Try to get historical report
    try:
        report = calibration_report(sport=sport)
        resolved = report.get("resolved", 0)
        total = report.get("total_predictions", 0)
        # Check if sufficient data
        if resolved < MIN_RESOLVED_FOR_CALIBRATION:
            return CalibrationOutput(
                raw_probability=raw_prob,
                calibrated_probability=round(raw_prob, 3),
                method="none",
                version="v1",
                is_active=False,
                inactive_reason=f"insufficient historical outcomes: {resolved} resolved < {MIN_RESOLVED_FOR_CALIBRATION} required (total {total})",
                brier_score=None,
            )
        # Find bucket for raw_prob
        bucket = _bucket_for_prob(raw_prob)
        curve = {c["bucket"]: c for c in report.get("curve", [])}
        bucket_data = curve.get(bucket)
        if not bucket_data or bucket_data.get("count", 0) < MIN_PER_BUCKET or bucket_data.get("actual_rate") is None:
            return CalibrationOutput(
                raw_probability=raw_prob,
                calibrated_probability=round(raw_prob, 3),
                method="none",
                version="v1",
                is_active=False,
                inactive_reason=f"bucket {bucket} insufficient: {bucket_data.get('count',0) if bucket_data else 0} < {MIN_PER_BUCKET} or no actual_rate",
                brier_score=report.get("brier_score"),
            )
        # Apply bucket correction: calibrated = actual_rate + (raw - predicted_rate) * 0.5 (shrinkage)
        # More robust: use actual_rate directly with shrinkage
        predicted_rate = bucket_data["predicted_rate"]
        actual_rate = bucket_data["actual_rate"]
        # Shrinkage factor based on bucket count
        count = bucket_data["count"]
        shrinkage = min(1.0, count / 50)  # more data = trust actual_rate more
        correction = (actual_rate - predicted_rate) * shrinkage
        calibrated = raw_prob + correction
        calibrated = max(0.05, min(0.95, calibrated))
        return CalibrationOutput(
            raw_probability=raw_prob,
            calibrated_probability=round(calibrated, 3),
            method="bucket",
            version="v1",
            is_active=True,
            brier_score=report.get("brier_score"),
            inactive_reason=None,
        )
    except Exception as e:
        # On any error, return inactive, never fake
        return CalibrationOutput(
            raw_probability=raw_prob,
            calibrated_probability=round(raw_prob, 3),
            method="none",
            version="v1",
            is_active=False,
            inactive_reason=f"calibration error: {str(e)[:80]}",
            brier_score=None,
        )

def calibrate_probability(raw_prob: float, bucket_correction: dict[str, float] | None = None) -> float:
    """Legacy helper — kept for backwards compat, now delegates to calibrate()."""
    if bucket_correction is None:
        # Try live calibration, but return just calibrated value for compat
        out = calibrate(raw_prob)
        return out.calibrated_probability
    bucket = f"{int(raw_prob*10)/10:.1f}"
    correction = bucket_correction.get(bucket, 0)
    return min(1, max(0, raw_prob + correction))
