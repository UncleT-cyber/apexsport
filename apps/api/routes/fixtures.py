from fastapi import APIRouter
from scanner.universe.discovery import discover_fixtures

router = APIRouter(prefix="/api", tags=["fixtures"])

@router.get("/fixtures")
async def list_fixtures(sport: str = "football"):
    fixtures = await discover_fixtures(sport=sport)
    return {"fixtures": fixtures, "total": len(fixtures)}

@router.get("/instruments/refresh")
async def refresh_instruments(sport: str = "football"):
    fixtures = await discover_fixtures(sport=sport)
    return {"status": "ok", "fixtures": fixtures, "sport": sport}

@router.post("/instruments/refresh")
async def post_refresh(sport: str = "football"):
    return await refresh_instruments(sport=sport)
