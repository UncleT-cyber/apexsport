"""Canonical Slip Store — in-memory with full lifecycle.

Persists BetSlip objects. In production this would be DB; for now
it's process memory but with proper identity and retrieval.
"""
from __future__ import annotations
from typing import Optional
from domain.slips.slip import BetSlip

_store: dict[str, BetSlip] = {}
_order: list[str] = []  # insertion order for listing

def save_slip(slip: BetSlip) -> BetSlip:
    _store[slip.id] = slip
    if slip.id not in _order:
        _order.append(slip.id)
    return slip

def get_slip(slip_id: str) -> Optional[BetSlip]:
    return _store.get(slip_id)

def list_slips(limit: int = 20) -> list[BetSlip]:
    # newest first
    out = []
    for sid in reversed(_order):
        s = _store.get(sid)
        if s:
            out.append(s)
            if len(out) >= limit:
                break
    return out

def delete_slip(slip_id: str) -> bool:
    if slip_id in _store:
        del _store[slip_id]
        _order.remove(slip_id) if slip_id in _order else None
        return True
    return False

def clear():
    _store.clear()
    _order.clear()
