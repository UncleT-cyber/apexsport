from __future__ import annotations
import asyncio
from fastapi import APIRouter, BackgroundTasks
from scanner.pipeline.state import get_scanner_state
from scanner.modes.manual import run_manual_scan
from scanner.universe.discovery import discover_fixtures

router = APIRouter(prefix="/api/scanner", tags=["scanner"])

@router.get("/state")
async def scanner_state(sport: str = "football", league: str | None = None):
    s = get_scanner_state()
    snap = s.get_snapshot()
    # Universe vs Batch: available (all for sport) vs eligible (after league filter)
    available = await discover_fixtures(sport=sport)
    eligible = available
    if league and league != "All Leagues":
        eligible = [f for f in available if f.get("competition") == league or str(f.get("competition_code","")) == str(league)]
    by_comp: dict[str, int] = {}
    for f in available:
        by_comp[f.get("competition","Unknown")] = by_comp.get(f.get("competition","Unknown"),0)+1
    # Provider telemetry: which provider supplied fixture vs odds, health
    try:
        from scanner.universe.discovery import get_last_discovery_telemetry
        from providers.registry.provider_registry import registry
        from providers.base.provider import ProviderCapability
        prov_tele = get_last_discovery_telemetry(sport, league)
        # Also build per-provider health for DATA SOURCES display
        health_map = {}
        for p in registry.for_capability(ProviderCapability.FIXTURES):
            try:
                h = await p.health()
                health_map[p.name] = {"status": h.status.value, "is_healthy": h.is_healthy, "configured": h.configured}
            except Exception:
                health_map[p.name] = {"status": "error", "is_healthy": False}
        # Odds providers
        for p in registry.for_capability(ProviderCapability.ODDS):
            if p.name not in health_map:
                try:
                    h = await p.health()
                    health_map[p.name] = {"status": h.status.value, "is_healthy": h.is_healthy, "configured": h.configured}
                except Exception:
                    pass
    except Exception:
        prov_tele = []
        health_map = {}
    snap_dict = snap.model_dump()
    snap_dict["instrument_universe"] = {
        "total_instruments": len(available),
        "scanner_universe_size": len(available),
        "eligible_count": len(eligible),
        "by_competition": by_comp,
        "providers_discovered": [f.get("provider") for f in available[:3]],
        "provider_telemetry": prov_tele,
        "provider_health": health_map,
        "fixture_source": prov_tele[0]["provider"] if prov_tele and prov_tele[0].get("count", 0) > 0 else (available[0].get("provider") if available else None),
        "odds_source": "the_odds_api" if health_map.get("the_odds_api", {}).get("configured") else None,
        "last_discovery_at": None,
        "discovery_errors": [t for t in prov_tele if t.get("status") == "DEGRADED"],
        "sport": sport,
        "league": league or "All Leagues",
        "available_leagues": sorted(by_comp.keys()),
    }
    # Telemetry: ELIGIBLE / SCANNING X/Y
    snap_dict["eligible_count"] = len(eligible)
    snap_dict["available_universe"] = len(available)
    # If not scanning, fixtures_total reflects eligible for next scan; if scanning, keep batch's fixtures_total
    snap_dict["fixtures_total"] = snap.fixtures_total if snap.is_scanning else len(eligible)
    # Expose stage_counts for explainable failure (directive section 13)
    snap_dict["stage_counts"] = snap.stage_counts
    snap_dict["scan_scope"] = snap.scan_scope
    snap_dict["scan_sport"] = snap.scan_sport
    snap_dict["scan_league"] = snap.scan_league
    return snap_dict

@router.get("/leagues")
async def list_leagues(sport: str = "football"):
    fixtures = await discover_fixtures(sport=sport)
    leagues = sorted(set(f.get("competition", "Unknown") for f in fixtures))
    return {"sport": sport, "leagues": leagues, "count": len(leagues)}

@router.post("/scan-now")
async def scan_now(background_tasks: BackgroundTasks, sport: str = "football", league: str | None = None, days: int = 7, batch_size: int = 20):
    state = get_scanner_state()
    if state.state.is_scanning:
        return {"status": "already_scanning"}
    # Enforce sport/league/date scope at backend domain, not frontend filter
    background_tasks.add_task(run_manual_scan, sport, None, league, days, batch_size, 0, None, None)
    return {"status": "started", "sport": sport, "league": league or "All Leagues", "days": days}

@router.get("/rejections")
async def list_rejections(scan_run_id: str | None = None, sport: str | None = None, limit: int = 100):
    """Structured rejection records for current or all scans — for rejection analysis UI and analytics."""
    from scanner.rejection_store import list_rejections as _list, aggregate as _agg
    items = _list(scan_run_id=scan_run_id, limit=limit, sport=sport)
    agg = _agg(scan_run_id=scan_run_id, sport=sport)
    return {"rejections": items, "aggregate": agg, "count": len(items)}

@router.get("/rejections/aggregate")
async def rejections_aggregate(scan_run_id: str | None = None, sport: str | None = None):
    from scanner.rejection_store import aggregate as _agg
    return _agg(scan_run_id=scan_run_id, sport=sport)

@router.get("/rejections/{fixture_id}")
async def get_rejection(fixture_id: str, scan_run_id: str | None = None):
    from scanner.rejection_store import list_rejections as _list
    # Search across all or specific scan
    candidates = _list(scan_run_id=scan_run_id, limit=500)
    for r in candidates:
        if r.get("fixture_id") == fixture_id:
            # Enrich with feature/market snapshot status where available
            return r
    # Also try to find fixture details from last discovery
    return {"error": f"Rejection for {fixture_id} not found", "fixture_id": fixture_id}

@router.get("/status")
async def scanner_status():
    return await scanner_state()
