"""Canonical Prediction Store — in-memory for now, with full provenance.

Every Prediction retains the full chain and is the permanent downstream identity.
"""
from __future__ import annotations
from typing import Optional

# Store is dict: prediction_id -> prediction dict (with full provenance)
_store: dict[str, dict] = {}

def save_prediction(pred: dict) -> dict:
    """Save canonical prediction, return stored."""
    pid = pred.get("id") or pred.get("fixture_id")
    # Ensure id exists
    if "id" not in pred:
        from core.identifiers import new_id
        pred["id"] = new_id("pred")
        pid = pred["id"]
    _store[pid] = pred
    # Also index by fixture_id for quick lookup
    _store[pred["fixture_id"]] = pred
    return pred

def get_prediction(pred_id: str) -> Optional[dict]:
    return _store.get(pred_id)

def list_predictions(limit: int = 20, sport: Optional[str] = None) -> list[dict]:
    # Deduplicate by id
    seen = set()
    out = []
    for p in reversed(list(_store.values())):
        pid = p.get("id")
        if pid in seen:
            continue
        seen.add(pid)
        if sport and p.get("sport") != sport:
            continue
        out.append(p)
        if len(out) >= limit:
            break
    return out

def clear():
    _store.clear()
