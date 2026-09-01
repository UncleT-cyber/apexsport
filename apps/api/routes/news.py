from fastapi import APIRouter
from ingestion.collectors.news import ingest_news, rank_by_relevance
from core.cache import cache
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/news", tags=["news"])

class NewsIngestRequest(BaseModel):
    items: list[dict]
    sport: str = "football"

# CanonicalNewsArticle example for docs:
# {id, sport, league, fixture_id, title, summary, image_url, published_at, source, source_url, type}

@router.get("")
async def list_news(sport: str = "football"):
    # 1. Check cache (ingested via provider or manual POST)
    cached = cache.get(f"news:{sport}")
    if cached is not None and len(cached) > 0:
        return {"news": [n.model_dump() for n in cached], "sport": sport, "cached": True, "source": "cache"}
    # 2. Try provider abstraction — Sportmonks News API via canonical NewsProvider
    try:
        from providers.news.sportmonks_news import fetch_sportmonks_news
        raw = await fetch_sportmonks_news(sport=sport, limit=12)
        if raw:
            ranked = await ingest_news(raw, sport=sport)
            return {"news": [n.model_dump() for n in ranked], "sport": sport, "cached": False, "source": "sportmonks"}
    except Exception:
        pass
    # 3. Graceful fallback — no news, provider unavailable or no articles in window
    # Do not hardcode fake news; return empty with message for landing page fallback UI
    if cached is not None:
        return {"news": [n.model_dump() for n in cached], "sport": sport, "cached": True, "source": "cache"}
    return {"news": [], "sport": sport, "cached": False, "message": "no news — provider unavailable or no articles in window", "source": "none"}

@router.post("/ingest")
async def ingest(body: NewsIngestRequest):
    # Ingest is protected in main.py for /api/news POST? Currently public, but ingestion should be via provider in prod
    # For landing page, GET will auto-fetch via provider; POST is for manual ingest/testing
    if not body.items:
        return {"error": "no items provided", "count": 0}
    ranked = await ingest_news(body.items, sport=body.sport)
    return {"news": [n.model_dump() for n in ranked], "count": len(ranked)}

@router.get("/canonical")
async def list_canonical(sport: str = "football"):
    """Public canonical news for landing page — same as GET / but explicitly canonical."""
    return await list_news(sport=sport)
