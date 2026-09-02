from __future__ import annotations
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core.config.settings import get_settings
from providers.registry.provider_registry import registry
from providers.sports_data.sportmonks.adapter import SportmonksAdapter
from providers.sports_data.api_football.adapter import ApiFootballAdapter
from providers.sports_data.sportradar.adapter import SportradarAdapter
from providers.odds.the_odds_api.adapter import TheOddsApiAdapter
import intelligence.agents.wire  # noqa: register 6 football agents
from sportsbooks.sportybet.adapter import SportyBetAdapter
from sportsbooks.bet9ja.adapter import Bet9jaAdapter
from sportsbooks.betway.adapter import BetwayAdapter
from sportsbooks.generic.adapter import GenericAdapter
from sportsbooks.registry import registry as sportsbook_registry

app = FastAPI(title="Apex Sports", version="0.1.0")

import os
_cors_raw = os.environ.get("APEXSPORT_CORS_ORIGINS", "")
_cors_list = [o.strip() for o in _cors_raw.split(",") if o.strip()] if _cors_raw else []
if not _cors_list:
    _cors_list = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register providers
try:
    registry.register(SportmonksAdapter(), priority=10)
    registry.register(ApiFootballAdapter(), priority=20)
    registry.register(SportradarAdapter(), priority=25)
    registry.register(TheOddsApiAdapter(), priority=30)
except Exception as e:
    print(f"[startup] provider registration failed: {e}")

# Register sportsbooks (generic adapter pattern — no private API reverse-engineering)
try:
    from sportsbooks.base import SportsbookAdapter as _SBA
    class _DraftKingsAdapter(_SBA):
        @property
        def name(self) -> str: return "draftkings"
    class _FanDuelAdapter(_SBA):
        @property
        def name(self) -> str: return "fanduel"
    for _sb in [SportyBetAdapter(), Bet9jaAdapter(), BetwayAdapter(), GenericAdapter(), _DraftKingsAdapter(), _FanDuelAdapter()]:
        sportsbook_registry.register(_sb)
except Exception as e:
    print(f"[startup] sportsbook registration failed: {e}")

from apps.api.routes import scanner as scanner_routes, fixtures as fixtures_routes, providers as providers_routes, slips as slips_routes, health as health_routes
from apps.api.routes.admin import router as admin_router
from apps.api.routes.auth import router as auth_router

# Optional routes — may fail if dependencies missing
try:
    from apps.api.routes.analytics import router as analytics_router
except Exception:
    analytics_router = None
try:
    from apps.api.routes.scheduling import router as scheduling_router
except Exception:
    scheduling_router = None
try:
    from apps.api.routes.news import router as news_router
except Exception:
    news_router = None
try:
    from apps.api.routes.live import router as live_router
except Exception:
    live_router = None
try:
    from apps.api.routes.settings import router as settings_router
except Exception:
    settings_router = None
try:
    from apps.api.routes.backtesting import router as backtesting_router
except Exception:
    backtesting_router = None
try:
    from apps.api.routes.predictions import router as predictions_router
except Exception:
    predictions_router = None
try:
    from apps.api.routes.brain import router as brain_router
except Exception:
    brain_router = None
try:
    from apps.api.routes.telemetry import router as telemetry_router
except Exception:
    telemetry_router = None
try:
    from apps.api.routes.copilot import router as copilot_router
except Exception:
    copilot_router = None
try:
    from apps.api.routes.verify import router as verify_router
except Exception:
    verify_router = None
from apps.api.dependencies.auth import get_current_user, get_current_admin

app.include_router(auth_router)
app.include_router(health_routes.router)
# Public for landing page — real fixtures/live/news via provider abstraction, no auth required
app.include_router(fixtures_routes.router)
if live_router: app.include_router(live_router)
if news_router: app.include_router(news_router)
# Protected — require JWT, MFA verified, ACTIVE status
from fastapi import Depends
app.include_router(scanner_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(providers_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(slips_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(admin_router, dependencies=[Depends(get_current_admin)])
if analytics_router: app.include_router(analytics_router, dependencies=[Depends(get_current_user)])
if scheduling_router: app.include_router(scheduling_router, dependencies=[Depends(get_current_user)])
if settings_router: app.include_router(settings_router, dependencies=[Depends(get_current_user)])
if backtesting_router: app.include_router(backtesting_router, dependencies=[Depends(get_current_user)])
if predictions_router: app.include_router(predictions_router, dependencies=[Depends(get_current_user)])
if brain_router: app.include_router(brain_router, dependencies=[Depends(get_current_user)])
if telemetry_router: app.include_router(telemetry_router, dependencies=[Depends(get_current_user)])
if copilot_router: app.include_router(copilot_router, dependencies=[Depends(get_current_user)])
if verify_router: app.include_router(verify_router, dependencies=[Depends(get_current_user)])

# Bootstrap auth — ensure at least one ADMIN invite exists for controlled testing
@app.on_event("startup")
async def _bootstrap_auth():
    try:
        from database.auth_store import list_users, create_user, create_reset_token
        from core.security import hash_password
        users = list_users()
        if not users:
            # Create initial admin invite — no hardcoded email check in code, role stored persistently
            admin = create_user(email="admin@apexsports.local", role="ADMIN", status="INVITED")
            token = create_reset_token(admin["email"])
            # Also create a default active admin for local dev if env is development
            import os
            if os.getenv("APEXSPORT_ENV", "development") in ("development", "testing"):
                # Create active admin with known password for local testing (not for production)
                # Password: Apex2024! — must be changed on first login
                active = create_user(email="apex@apexsports.local", role="ADMIN", status="ACTIVE", password_hash=hash_password("Apex2024!"))
                print(f"[auth] Bootstrapped admin apex@apexsports.local / Apex2024! (dev only)")
            print(f"[auth] Invite created for admin@apexsports.local token {token[:12]}... (use POST /api/auth/reset to activate)")
    except Exception as e:
        print(f"[auth] bootstrap failed: {e}")

# Wire background scheduling/event-triggered once at startup (lightweight, does not block web)
try:
    from scanner.modes.event_triggered import wire_event_triggered as _wire_et
    _wire_et()
except Exception:
    pass

from apps.api.websocket import broadcaster
from core.events.bus import event_bus, EventType

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    q = broadcaster.subscribe()
    # also forward scanner state polling via WS
    try:
        while True:
            try:
                data = await asyncio.wait_for(q.get(), timeout=20)
                await ws.send_text(json.dumps(data, default=str))
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"event_type": "HEALTH_CHECK", "data": {}}))
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.unsubscribe(q)
