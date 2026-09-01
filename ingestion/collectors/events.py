"""Collectors: fetch raw from providers, push to normalization."""
from typing import Optional
from datetime import datetime
from providers.registry.provider_registry import registry
from providers.base.provider import ProviderCapability
from ingestion.normalization.events import normalize_event
from core.cache import cache

async def collect_fixtures(date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> list[dict]:
    cache_key = f"fixtures:{date_from}:{date_to}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    results: list[dict] = []
    for p in registry.for_capability(ProviderCapability.FIXTURES):
        if not p.is_configured():
            continue
        try:
            raw_list = await p.fetch_fixtures(date_from, date_to)
            for raw in raw_list:
                results.append(normalize_event(raw, p.name))
        except Exception:
            continue
    if results:
        cache.set(cache_key, results, ttl_seconds=60)
    return results
