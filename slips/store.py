"""Canonical Slip Store — Supabase PostgreSQL with in-memory fallback.

Persists BetSlip objects. When Supabase is configured, data survives restarts.
Otherwise falls back to in-memory (development only).
"""
from __future__ import annotations
from typing import Optional
from datetime import datetime, timezone
import json

from domain.slips.slip import BetSlip

# In-memory fallback
_store: dict[str, BetSlip] = {}
_order: list[str] = []


def _use_supabase() -> bool:
    try:
        from database.supabase_client import is_configured
        return is_configured()
    except Exception:
        return False


def _row_to_slip(row: dict) -> BetSlip:
    """Convert Supabase JSONB row back to BetSlip."""
    data = row.get("data", row)
    if isinstance(data, str):
        data = json.loads(data)
    # Reconstruct datetime from string if needed
    if isinstance(data.get("created_at"), str):
        try:
            data["created_at"] = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
        except Exception:
            pass
    return BetSlip(**data)


def save_slip(slip: BetSlip) -> BetSlip:
    if _use_supabase():
        from database.supabase_client import upsert
        slip_data = slip.model_dump()
        # Serialize datetime to string for JSONB
        if isinstance(slip_data.get("created_at"), datetime):
            slip_data["created_at"] = slip_data["created_at"].isoformat()
        # Serialize each selection's data
        for s in slip_data.get("selections", []):
            if isinstance(s.get("model_config"), dict):
                pass  # pydantic model_config is not data
        upsert("slips", {"id": slip.id, "data": slip_data, "created_at": datetime.now(timezone.utc).isoformat()})
    else:
        _store[slip.id] = slip
        if slip.id not in _order:
            _order.append(slip.id)
    return slip


def get_slip(slip_id: str) -> Optional[BetSlip]:
    if _use_supabase():
        from database.supabase_client import select_one
        row = select_one("slips", {"id": slip_id})
        return _row_to_slip(row) if row else None
    return _store.get(slip_id)


def list_slips(limit: int = 20) -> list[BetSlip]:
    if _use_supabase():
        from database.supabase_client import select
        rows = select("slips", order="created_at.desc", limit=limit)
        return [_row_to_slip(r) for r in rows]
    out = []
    for sid in reversed(_order):
        s = _store.get(sid)
        if s:
            out.append(s)
            if len(out) >= limit:
                break
    return out


def delete_slip(slip_id: str) -> bool:
    if _use_supabase():
        from database.supabase_client import delete
        delete("slips", {"id": slip_id})
        return True
    if slip_id in _store:
        del _store[slip_id]
        _order.remove(slip_id) if slip_id in _order else None
        return True
    return False


def clear():
    if _use_supabase():
        from database.supabase_client import delete
        # Delete all slips (no filter = delete all with service_role)
        delete("slips", {})
    else:
        _store.clear()
        _order.clear()
