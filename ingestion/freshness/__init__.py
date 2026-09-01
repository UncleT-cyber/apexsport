"""Freshness — respects provider TTL, event_state, market movement, live status.

Never serve stale critical info without indicating age.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional

# TTL by event state (seconds)
TTL_BY_STATUS = {
    "scheduled": 120,
    "live": 10,
    "halftime": 15,
    "completed": 3600,
    "postponed": 600,
    "cancelled": 600,
}

def ttl_for_status(status: str) -> float:
    return TTL_BY_STATUS.get(status.lower(), 60)

def is_fresh(fetched_at: datetime, max_age_seconds: float, now: Optional[datetime] = None) -> bool:
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    n = now or datetime.now(timezone.utc)
    return (n - fetched_at).total_seconds() <= max_age_seconds

def age_seconds(fetched_at: datetime, now: Optional[datetime] = None) -> float:
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    n = now or datetime.now(timezone.utc)
    return (n - fetched_at).total_seconds()

def freshness_label(age_s: float, ttl: float) -> str:
    if age_s <= ttl:
        return "fresh"
    if age_s <= ttl * 2:
        return "stale"
    return "expired"

def compute_freshness(fetched_at: datetime, status: str) -> dict:
    ttl = ttl_for_status(status)
    age = age_seconds(fetched_at)
    return {
        "age_seconds": round(age, 1),
        "ttl_seconds": ttl,
        "is_stale": age > ttl,
        "label": freshness_label(age, ttl),
        "status": status,
    }
