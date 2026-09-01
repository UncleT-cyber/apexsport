"""Odds ingestion: fetch from odds providers → normalize → value engine."""
from __future__ import annotations
from typing import Optional
from providers.registry.provider_registry import registry
from providers.base.provider import ProviderCapability
from market.odds import batch_normalize
from market.value import assess_value

async def collect_odds(event_id: Optional[str] = None, sport: str = "football") -> list[dict]:
    """Collectors fetch raw odds, normalize to canonical OddsSnapshot.

    Returns ONLY real odds from configured providers.
    When no provider configured, returns empty list — pipeline marks UNAVAILABLE.
    Never fabricates odds.
    """
    raw_all: list[dict] = []
    for p in registry.for_capability(ProviderCapability.ODDS):
        if not p.is_configured():
            continue
        try:
            raw = await p.fetch_odds(event_id=event_id)
            raw_all.extend(raw or [])
        except Exception:
            continue

    if not raw_all:
        return []

    normalized = batch_normalize(raw_all, sport=sport)
    return [n.model_dump() for n in normalized]
