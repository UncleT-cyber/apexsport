from fastapi import APIRouter
from ingestion.collectors.live import poll_live
from ingestion.freshness import compute_freshness
from datetime import datetime, timezone

router = APIRouter(prefix="/api/live", tags=["live"])

@router.get("")
async def live_fixtures(sport: str = "football"):
    live = await poll_live(sport=sport)
    now = datetime.now(timezone.utc)
    enriched = []
    for f in live:
        enriched.append({**f, "freshness": compute_freshness(now, f.get("status","live"))})
    return {"live": enriched, "count": len(enriched), "sport": sport}

@router.get("/freshness")
async def live_freshness(sport: str = "football"):
    from core.cache import cache
    age = cache.age_seconds(f"live:{sport}")
    return {"sport": sport, "age_seconds": age, "ttl_seconds": 10, "is_stale": (age or 999) > 10 if age is not None else True}
