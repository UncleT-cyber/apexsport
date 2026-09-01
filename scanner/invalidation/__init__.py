"""Dependency-aware incremental invalidation.

live_rescan: only affected fixtures, not whole universe.
"""
from __future__ import annotations
from core.cache import cache

GRAPH = {
    "INJURY_DETECTED": ["player","team","fixtures","features","predictions","value","risk"],
    "LINEUP_UPDATED": ["team","fixtures","features","predictions"],
    "ODDS_UPDATED": ["value","risk"],
    "MATCH_STARTED": ["fixtures","features","predictions","live"],
    "MATCH_FINISHED": ["fixtures","predictions","calibration"],
    "NEWS_RECEIVED": ["player_availability","match_context","risk"],
}

def affected_nodes(event_type: str) -> list[str]:
    return GRAPH.get(event_type, [])

def invalidate_for_event(event_type: str, fixture_ids: list[str] | None = None) -> None:
    nodes = affected_nodes(event_type)
    # cache keys are prefix-based: fixtures:, live:, features:
    if "fixtures" in nodes or "live" in nodes:
        cache.invalidate_prefix("fixtures:")
        cache.invalidate_prefix("live:")
    if "features" in nodes:
        cache.invalidate_prefix("features:")
    if fixture_ids:
        for fid in fixture_ids:
            cache.invalidate(f"prediction:{fid}")
            cache.invalidate(f"value:{fid}")

def is_incremental(event_type: str) -> bool:
    return event_type in ("INJURY_DETECTED","LINEUP_UPDATED","ODDS_UPDATED","NEWS_RECEIVED")

