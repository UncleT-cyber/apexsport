"""Live collector — polls LIVESCORE capability, emits MATCH_STARTED / MATCH_FINISHED / ODDS_UPDATED."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from core.cache import cache
from core.events.bus import Event, EventType, event_bus
from providers.registry.provider_registry import registry
from providers.base.provider import ProviderCapability
from ingestion.freshness import compute_freshness

async def poll_live(sport: str = "football") -> list[dict]:
    """Fetch live fixtures — TTL 10s, publishes live events."""
    cache_key = f"live:{sport}"
    # live TTL 10s; cache respects status
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    live: list[dict] = []
    for p in registry.for_capability(ProviderCapability.LIVESCORE):
        if not p.is_configured():
            continue
        try:
            raw = await p.fetch_fixtures()  # providers may return status field
            for r in raw or []:
                if str(r.get("status", "")).lower() in ("live","halftime","inplay","in_play"):
                    r["sport"] = sport
                    live.append(r)
        except Exception:
            continue

    # No provider/poll returned live — return empty, never fabricate.
    # UNAVAILABLE is a valid state. Do not synthesize live fixtures from universe.
    if not live:
        # Return empty list — live status is strictly provider-derived.
        # Frontend will show 0 live / UNAVAILABLE rather than fake every-3rd injection.
        pass

    # publish events for state transitions
    now = datetime.now(timezone.utc)
    for f in live:
        fid = f.get("id", "unknown")
        event_bus.emit_sync(Event(
            event_type=EventType.MATCH_STARTED if f.get("status")=="live" else EventType.ODDS_UPDATED,
            source="live_collector",
            data={"fixture_id": fid, "status": f.get("status"), "sport": sport, "freshness": compute_freshness(now, f.get("status","live"))}
        ))

    cache.set(cache_key, live, ttl_seconds=10)
    return live

def invalidate_live(sport: str) -> None:
    cache.invalidate(f"live:{sport}")
