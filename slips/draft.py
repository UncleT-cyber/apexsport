"""Draft Slip workspace — current/uncommitted selection state (cart).

Distinguishes:
  Current/uncommitted selection state — working slip/cart (in-memory draft, per-process singleton for single-user demo)
from:
  Persisted Slip — finalized BetSlip in slips/store.py

Direction: Prediction → SlipSelection → Current Slip (draft) → Validation → Optimization → Persisted Slip
Every SlipSelection retains prediction_id trace.

No hardcoded fixtures. No fake booking codes.
"""
from __future__ import annotations

import time
from typing import Optional

from domain.slips.slip import SlipSelection, BetSlip
from slips.store import save_slip

# In-memory draft — singleton (single user). In production this would be per-user session/DB.
_draft_ids: list[str] = []  # ordered prediction_ids
_draft_added_at: dict[str, float] = {}
_DRAFT_MAX = 20


def get_draft_ids() -> list[str]:
    return list(_draft_ids)


def add_to_draft(prediction_id: str) -> tuple[bool, Optional[str]]:
    if prediction_id in _draft_ids:
        return False, "Prediction already in slip (duplicate not allowed)"
    if len(_draft_ids) >= _DRAFT_MAX:
        return False, f"Slip limit reached ({_DRAFT_MAX} selections max)"
    _draft_ids.append(prediction_id)
    _draft_added_at[prediction_id] = time.time()
    return True, None


def remove_from_draft(prediction_id: str) -> bool:
    if prediction_id in _draft_ids:
        _draft_ids.remove(prediction_id)
        _draft_added_at.pop(prediction_id, None)
        return True
    return False


def clear_draft() -> None:
    _draft_ids.clear()
    _draft_added_at.clear()


def is_stale(pred: dict, max_hours: int = 48) -> tuple[bool, Optional[str]]:
    """Check if prediction snapshot is stale beyond limit."""
    raw = pred.get("created_at") or pred.get("captured_at") or pred.get("kickoff_at")
    if not raw:
        return False, None
    try:
        ts = raw
        # try ISO parse
        from datetime import datetime
        if isinstance(raw, str):
            # handle Z
            iso = raw.replace("Z", "+00:00")
            dt = datetime.fromisoformat(iso)
            ts = dt.timestamp()
        elif isinstance(raw, (int, float)):
            ts = float(raw)
        else:
            return False, None
        age_hours = (time.time() - float(ts)) / 3600
        if age_hours > max_hours:
            return True, f"market snapshot stale ({age_hours:.1f}h > {max_hours}h)"
        return False, None
    except Exception:
        return False, None


def validate_prediction_for_draft(pred: dict, existing_ids: set[str]) -> tuple[bool, Optional[str]]:
    """Canonical validation before ADD TO SLIP — mirrors frontend validatePredictionForSlip."""
    pid = pred.get("id") or pred.get("fixture_id")
    if not pid:
        return False, "Prediction missing identifier"
    if pid in existing_ids:
        return False, "Prediction already in slip"
    if not pred.get("market") or not pred.get("selection"):
        return False, "Missing market/selection — not eligible"
    if not pred.get("fixture_id") or not pred.get("fixture_label"):
        return False, "Missing fixture information"
    if pred.get("market_odds") is None or pred.get("market_odds", 0) < 1.01:
        return False, "Odds unavailable or invalid (<1.01)"
    if not pred.get("sport"):
        return False, "Missing sport — cannot determine market semantics"
    # sport-aware market
    sport = pred.get("sport")
    market = pred.get("market")
    sel = pred.get("selection")
    if sport == "basketball" and market == "MONEYLINE" and sel == "DRAW":
        return False, "Basketball MONEYLINE has no DRAW"
    try:
        from intelligence.market_registry import validate_market
        ok, reason = validate_market(sport, market, sel)
        if not ok:
            return False, reason
    except Exception as e:
        return False, f"market validation error: {e}"
    stale, reason = is_stale(pred)
    if stale:
        return False, reason
    return True, None


def build_draft_selections() -> list[SlipSelection]:
    """Build canonical SlipSelections from draft_ids via prediction_store."""
    from intelligence.prediction_store import get_prediction, list_predictions

    selections: list[SlipSelection] = []
    for pid in _draft_ids:
        # Use get_prediction which checks both id and fixture_id indexes
        pred = get_prediction(pid)
        if not pred:
            # fallback search in list (in case dict indexing missed)
            for p in list_predictions(limit=200):
                if p.get("id") == pid or p.get("fixture_id") == pid:
                    pred = p
                    break
        if not pred:
            continue
        # Convert via canonical helper
        try:
            from apps.api.routes.slips import _to_selection  # reuse canonical converter
            selections.append(_to_selection(pred))
        except Exception:
            # fallback inline — no hardcoded odds (UNAVAILABLE handled by validator)
            selections.append(SlipSelection(
                event_id=pred["fixture_id"],
                event_label=pred.get("fixture_label", pred["fixture_id"]),
                market=pred.get("market") or "MATCH_RESULT",
                selection=pred.get("selection") or "HOME",
                odds=pred.get("market_odds"),
                probability=pred.get("probability"),
                calibrated_probability=pred.get("calibrated_probability"),
                edge=pred.get("edge"),
                confidence=pred.get("confidence"),
                prediction_id=pred.get("id") or pred.get("fixture_id"),
                sport=pred.get("sport"),
                competition=pred.get("competition"),
                kickoff_at=str(pred.get("kickoff_at")) if pred.get("kickoff_at") else None,
                model_used=pred.get("model_used"),
            ))
    return selections


def build_current_slip(sportsbook: Optional[str] = None) -> tuple[BetSlip, dict]:
    """Build current Draft Slip (not yet persisted) — for preview/validate."""
    selections = build_draft_selections()
    from slips.validator import validate_slip
    from risk.correlation import correlation_score
    from risk.engine import assess_risk

    slip = BetSlip(selections=selections, sportsbook=sportsbook)
    slip = slip.model_copy(update={"total_odds": slip.compute_total_odds()})
    ok, errors = validate_slip(slip)
    # Enrich with correlation + aggregate risk for workspace display
    corr = correlation_score([s.model_dump() for s in selections]) if selections else 0
    avg_conf = sum(s.confidence or 0.5 for s in selections) / len(selections) if selections else 0
    avg_edge = sum(s.edge or 0 for s in selections) / len(selections) if selections else 0
    overall = assess_risk(confidence=avg_conf, edge=avg_edge, data_quality="ok", market_quality="ok", correlation=corr, selection_count=len(selections))
    slip = slip.model_copy(update={"risk_level": overall.level})
    meta = {
        "count": len(selections),
        "total_odds": slip.total_odds,
        "correlation": round(corr, 3),
        "aggregate_risk": overall.level,
        "valid": ok,
        "validation_errors": errors,
    }
    return slip, meta
