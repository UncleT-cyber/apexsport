"""Structured rejection store — persistence for scan candidate rejections.

Every rejected fixture retains:
  scan_run_id, fixture_id, status=REJECTED, rejection_code, rejection_stage, rejection_reason,
  pipeline_trace, timestamp,
  feature_snapshot_id, market_snapshot_id, model, model_version, prompt_version, prompt_hash

Categories (structured codes, not arbitrary UI strings):
  INSUFFICIENT_DATA, INTELLIGENCE_INCOMPLETE, ENSEMBLE_INVALID, CALIBRATION_UNAVAILABLE,
  LOW_VALUE, RISK_BLOCKED, TECHNICAL_FAILURE, INVALID_MARKET, STALE_DATA
"""
from __future__ import annotations
import time
import hashlib
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

# In-memory store: scan_run_id -> list of rejection dicts
_store: dict[str, list[dict]] = {}
# Also global list for all rejections (for analytics)
_all: list[dict] = []

REJECTION_CODES = [
    "INSUFFICIENT_DATA",
    "INTELLIGENCE_INCOMPLETE",
    "ENSEMBLE_INVALID",
    "CALIBRATION_UNAVAILABLE",
    "LOW_VALUE",
    "RISK_BLOCKED",
    "TECHNICAL_FAILURE",
    "INVALID_MARKET",
    "STALE_DATA",
]

def _prompt_hash(prompt_version: str, template: str = "") -> str:
    if not template:
        return hashlib.sha256(prompt_version.encode()).hexdigest()[:8]
    return hashlib.sha256((prompt_version + template).encode()).hexdigest()[:12]

def save_rejection(
    scan_run_id: str,
    fixture_id: str,
    fixture_label: str | None = None,
    sport: str | None = None,
    competition: str | None = None,
    rejection_code: str = "TECHNICAL_FAILURE",
    rejection_stage: str = "UNKNOWN",
    rejection_reason: str = "",
    pipeline_trace: Optional[List[Dict[str, Any]]] = None,
    feature_snapshot_id: Optional[str] = None,
    market_snapshot_id: Optional[str] = None,
    model: Optional[str] = None,
    model_version: Optional[str] = None,
    prompt_version: Optional[str] = None,
    prompt_hash: Optional[str] = None,
    timestamp: Optional[float] = None,
    kickoff_at: Optional[str] = None,
) -> dict:
    if rejection_code not in REJECTION_CODES:
        # Allow extension but normalize
        rejection_code = "TECHNICAL_FAILURE"
    rec = {
        "scan_run_id": scan_run_id,
        "fixture_id": fixture_id,
        "fixture_label": fixture_label or fixture_id,
        "sport": sport,
        "competition": competition,
        "status": "REJECTED",
        "rejection_code": rejection_code,
        "rejection_stage": rejection_stage,
        "rejection_reason": rejection_reason,
        "pipeline_trace": pipeline_trace or [],
        "timestamp": timestamp or time.time(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "feature_snapshot_id": feature_snapshot_id,
        "market_snapshot_id": market_snapshot_id,
        "model": model,
        "model_version": model_version,
        "prompt_version": prompt_version,
        "prompt_hash": prompt_hash or _prompt_hash(prompt_version or "v1"),
        "kickoff_at": kickoff_at,
    }
    _store.setdefault(scan_run_id, []).append(rec)
    _all.append(rec)
    # Keep only last 500
    if len(_all) > 500:
        _all.pop(0)
    return rec

def list_rejections(scan_run_id: Optional[str] = None, limit: int = 100, sport: Optional[str] = None) -> list[dict]:
    if scan_run_id:
        lst = _store.get(scan_run_id, [])
    else:
        lst = _all
    if sport:
        lst = [r for r in lst if r.get("sport") == sport]
    # Most recent first
    return list(reversed(lst))[:limit]

def aggregate(scan_run_id: Optional[str] = None, sport: Optional[str] = None) -> dict:
    """Aggregate breakdown for rejection analysis UI: counts per code, total, per sport/league."""
    lst = list_rejections(scan_run_id=scan_run_id, limit=1000, sport=sport)
    from collections import Counter
    by_code = Counter(r.get("rejection_code", "UNKNOWN") for r in lst)
    by_stage = Counter(r.get("rejection_stage", "UNKNOWN") for r in lst)
    by_sport = Counter(r.get("sport", "unknown") for r in lst)
    # Build league breakdown where available
    by_league = Counter(r.get("competition", "Unknown") for r in lst)
    total = len(lst)
    # Ensure all codes present even if 0
    breakdown = {code: by_code.get(code, 0) for code in REJECTION_CODES}
    # Only include codes with >0 for UI, but keep total
    filtered = {k: v for k, v in breakdown.items() if v > 0}
    return {
        "total": total,
        "by_code": filtered,
        "by_stage": dict(by_stage),
        "by_sport": dict(by_sport),
        "by_league": dict(by_league),
        "scan_run_id": scan_run_id or "all",
    }

def clear(scan_run_id: Optional[str] = None) -> None:
    if scan_run_id:
        _store.pop(scan_run_id, None)
        global _all
        _all = [r for r in _all if r.get("scan_run_id") != scan_run_id]
    else:
        _store.clear()
        _all.clear()

def get_last_scan_id() -> Optional[str]:
    if _store:
        # Most recent scan_run_id is last key inserted
        return list(_store.keys())[-1]
    return None
