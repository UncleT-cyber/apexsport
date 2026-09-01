"""News intelligence: ingest → normalize → timestamp → entity-link → dedup → rank → score relevance.

News may affect player availability, team state, prediction confidence, risk.
AI reasons over structured news evidence, not blind browsing.
"""
from __future__ import annotations
import hashlib
import re
from datetime import datetime, timezone
from typing import Optional
from providers.news.base import NewsItem
from core.cache import cache
from core.events.bus import Event, EventType, event_bus

# Minimal entity lexicon — in production backed by participants/players tables
TEAM_ALIASES = {
    "arsenal": "ARS", "chelsea": "CHE", "man city": "MCI", "liverpool": "LIV",
    "lakers": "LAL", "warriors": "GSW", "celtics": "BOS", "knicks": "NYK",
}

def _dedup_key(title: str, entities: list[str]) -> str:
    raw = (title.lower() + "|" + "|".join(sorted(entities))).encode()
    return hashlib.sha256(raw).hexdigest()[:12]

def normalize_news(raw: dict) -> NewsItem:
    title = (raw.get("title") or raw.get("headline") or "").strip()
    body = (raw.get("body") or raw.get("summary") or "").strip()
    published_at = raw.get("published_at") or raw.get("timestamp") or datetime.now(timezone.utc)
    if isinstance(published_at, str):
        try:
            published_at = datetime.fromisoformat(published_at.replace("Z","+00:00"))
        except Exception:
            published_at = datetime.now(timezone.utc)
    # entity-link: naive keyword matching
    text = (title + " " + body).lower()
    entities: list[str] = []
    for alias, code in TEAM_ALIASES.items():
        if alias in text:
            entities.append(code)
    # relevance: injury/lineup keywords boost
    relevance = 0.5
    if any(k in text for k in ["injury","suspended","doubt","lineup","ruled out","questionable"]):
        relevance = 0.9
    elif any(k in text for k in ["transfer","contract","coach"]):
        relevance = 0.3
    dedup = _dedup_key(title, entities)
    return NewsItem(
        id=raw.get("id") or dedup,
        title=title,
        body=body,
        source=raw.get("source","unknown"),
        published_at=published_at,
        url=raw.get("url"),
        entities=entities,
        relevance_score=relevance,
        dedup_key=dedup,
    )

_seen_dedup: set[str] = set()

def deduplicate(items: list[NewsItem]) -> list[NewsItem]:
    out: list[NewsItem] = []
    for it in items:
        if it.dedup_key in _seen_dedup:
            continue
        _seen_dedup.add(it.dedup_key)
        out.append(it)
    return out

def rank_by_relevance(items: list[NewsItem]) -> list[NewsItem]:
    return sorted(items, key=lambda x: (x.relevance_score, x.published_at.timestamp()), reverse=True)

async def ingest_news(raw_items: list[dict], sport: str = "football") -> list[NewsItem]:
    """Full pipeline: normalize → dedup → rank → cache → emit events."""
    normalized = [normalize_news(r) for r in raw_items]
    deduped = deduplicate(normalized)
    ranked = rank_by_relevance(deduped)

    # cache latest news per sport
    cache.set(f"news:{sport}", ranked, ttl_seconds=300)

    # emit high-relevance news that affects availability/confidence
    for item in ranked:
        if item.relevance_score >= 0.7:
            affected = item.entities
            # map to fixtures: naive — any fixture containing entity code in label
            from scanner.universe.discovery import discover_fixtures
            fixtures = await discover_fixtures(sport=sport)
            affected_fixtures = [f["id"] for f in fixtures if any(e in f.get("label","") for e in affected)]
            event_bus.emit_sync(Event(
                event_type=EventType.NEWS_RECEIVED,
                source="news_ingestion",
                data={
                    "news_id": item.id,
                    "title": item.title,
                    "entities": item.entities,
                    "relevance": item.relevance_score,
                    "affected_fixtures": affected_fixtures,
                    "sport": sport,
                }
            ))
            # high-relevance injury news also triggers availability invalidation
            if any(k in item.title.lower() for k in ["injury","ruled out"]):
                event_bus.emit_sync(Event(
                    event_type=EventType.INJURY_DETECTED,
                    source="news_ingestion",
                    data={"news_id": item.id, "entities": item.entities, "affected_fixtures": affected_fixtures}
                ))

    return ranked
