from __future__ import annotations
import os
import sys
import traceback

# ── CRASH-PROOF: Create app + CORS + health FIRST, before any heavy imports ──
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Apex Sports", version="0.1.0")

# CORS — use * with allow_credentials=True; Starlette echoes back the specific origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Health endpoint — guaranteed to work, no dependencies
@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "apexsports-api"}

@app.get("/")
async def root():
    return {"status": "ok", "service": "apexsports-api"}

# Global exception handler — guarantees CORS headers even on500s
from fastapi import Request
from fastapi.responses import ORJSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback as _tb
    print(f"[error] Unhandled: {request.method} {request.url.path}: {exc}")
    _tb.print_exc()
    origin = request.headers.get("origin", "")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Expose-Headers"] = "*"
    return ORJSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)[:200]},
        headers=headers,
    )

@app.exception_handler(500)
async def err500(request: Request, exc: Exception):
    return await global_exception_handler(request, exc)

# ── Deferred imports — wrapped in try/except so app ALWAYS starts ─────────────
_startup_errors = []

def _safe_import(module_path, label=None):
    """Import a module, returning None on failure."""
    try:
        parts = module_path.split(".")
        mod = __import__(module_path)
        for p in parts[1:]:
            mod = getattr(mod, p)
        return mod
    except Exception as e:
        _startup_errors.append(f"{label or module_path}: {e}")
        return None

def _safe_import_attr(module_path, attr_name, label=None):
    """Import an attribute from a module, returning None on failure."""
    try:
        parts = module_path.split(".")
        mod = __import__(module_path)
        for p in parts[1:]:
            mod = getattr(mod, p)
        return getattr(mod, attr_name)
    except Exception as e:
        _startup_errors.append(f"{label or module_path}.{attr_name}: {e}")
        return None

# Auth deps (critical — needed for route protection)
get_current_user = _safe_import_attr("apps.api.dependencies.auth", "get_current_user", "auth_deps")
get_current_admin = _safe_import_attr("apps.api.dependencies.auth", "get_current_admin", "auth_deps")

# Core settings
settings = _safe_import_attr("core.config.settings", "get_settings", "settings")
if settings:
    try:
        settings()
    except Exception:
        pass

# Provider/sportsbook registries
registry = _safe_import_attr("providers.registry.provider_registry", "registry", "provider_registry")
sportsbook_registry = _safe_import_attr("sportsbooks.registry", "registry", "sportsbook_registry")

# Adapter classes
_adapter_imports = {
    "SportmonksAdapter": ("providers.sports_data.sportmonks.adapter", "SportmonksAdapter"),
    "ApiFootballAdapter": ("providers.sports_data.api_football.adapter", "ApiFootballAdapter"),
    "SportradarAdapter": ("providers.sports_data.sportradar.adapter", "SportradarAdapter"),
    "TheOddsApiAdapter": ("providers.odds.the_odds_api.adapter", "TheOddsApiAdapter"),
    "SportyBetAdapter": ("sportsbooks.sportybet.adapter", "SportyBetAdapter"),
    "Bet9jaAdapter": ("sportsbooks.bet9ja.adapter", "Bet9jaAdapter"),
    "BetwayAdapter": ("sportsbooks.betway.adapter", "BetwayAdapter"),
    "GenericAdapter": ("sportsbooks.generic.adapter", "GenericAdapter"),
}

_adapters = {}
for name, (mod_path, attr) in _adapter_imports.items():
    cls = _safe_import_attr(mod_path, attr, name)
    if cls:
        _adapters[name] = cls

# Register providers
if registry:
    for name in ["SportmonksAdapter", "ApiFootballAdapter", "SportradarAdapter", "TheOddsApiAdapter"]:
        if name in _adapters:
            try:
                registry.register(_adapters[name](), priority=10 + list(_adapter_imports.keys()).index(name) * 10)
            except Exception as e:
                _startup_errors.append(f"register {name}: {e}")

# Register sportsbooks
if sportsbook_registry:
    for name in ["SportyBetAdapter", "Bet9jaAdapter", "BetwayAdapter", "GenericAdapter"]:
        if name in _adapters:
            try:
                sportsbook_registry.register(_adapters[name]())
            except Exception as e:
                _startup_errors.append(f"register {name}: {e}")
    # DraftKings/FanDuel generic adapters
    try:
        sb_base = _safe_import_attr("sportsbooks.base", "SportsbookAdapter", "sb_base")
        if sb_base:
            class _DK(sb_base):
                @property
                def name(self) -> str: return "draftkings"
            class _FD(sb_base):
                @property
                def name(self) -> str: return "fanduel"
            sportsbook_registry.register(_DK())
            sportsbook_registry.register(_FD())
    except Exception:
        pass

# Intelligence agents (optional)
_safe_import("intelligence.agents.wire", "agents_wire")

# Wire event-triggered (optional)
try:
    _wire_et = _safe_import_attr("scanner.modes.event_triggered", "wire_event_triggered", "event_triggered")
    if _wire_et:
        _wire_et()
except Exception:
    pass

# ── Register routers ──────────────────────────────────────────────────────────
def _add_router(module_path, attr_name, prefix=None, auth="user"):
    """Safely import and register a router."""
    r = _safe_import_attr(module_path, attr_name, module_path)
    if r is None:
        return
    deps = []
    if auth == "user" and get_current_user:
        from fastapi import Depends
        deps.append(Depends(get_current_user))
    elif auth == "admin" and get_current_admin:
        from fastapi import Depends
        deps.append(Depends(get_current_admin))
    try:
        if deps:
            app.include_router(r, dependencies=deps)
        else:
            app.include_router(r)
    except Exception as e:
        _startup_errors.append(f"include_router {module_path}: {e}")

# Core routers (must-load)
_core_routers = [
    ("apps.api.routes.auth", "router", None, "none"),
    ("apps.api.routes.health", "router", None, "none"),
    ("apps.api.routes.fixtures", "router", None, "none"),
    ("apps.api.routes.scanner", "router", None, "user"),
    ("apps.api.routes.providers", "router", None, "user"),
    ("apps.api.routes.slips", "router", None, "user"),
    ("apps.api.routes.admin", "router", None, "admin"),
]

# Optional routers
_optional_routers = [
    ("apps.api.routes.analytics", "router", None, "user"),
    ("apps.api.routes.scheduling", "router", None, "user"),
    ("apps.api.routes.news", "router", None, "none"),
    ("apps.api.routes.live", "router", None, "none"),
    ("apps.api.routes.settings", "router", None, "user"),
    ("apps.api.routes.backtesting", "router", None, "user"),
    ("apps.api.routes.predictions", "router", None, "user"),
    ("apps.api.routes.brain", "router", None, "user"),
    ("apps.api.routes.telemetry", "router", None, "user"),
    ("apps.api.routes.copilot", "router", None, "user"),
    ("apps.api.routes.verify", "router", None, "user"),
]

for module_path, attr, prefix, auth in _core_routers:
    _add_router(module_path, attr, prefix, auth)

for module_path, attr, prefix, auth in _optional_routers:
    _add_router(module_path, attr, prefix, auth)

# ── Bootstrap auth ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def _bootstrap_auth():
    try:
        from database.auth_store import list_users, create_user, create_reset_token
        from core.security import hash_password
        users = list_users()
        if not users:
            admin = create_user(email="admin@apexsports.local", role="ADMIN", status="INVITED")
            token = create_reset_token(admin["email"])
            if os.getenv("APEXSPORT_ENV", "development") in ("development", "testing"):
                active = create_user(email="apex@apexsports.local", role="ADMIN", status="ACTIVE",
                                     password_hash=hash_password("Apex2024!"))
                print(f"[auth] Bootstrapped admin apex@apexsports.local / Apex2024! (dev only)")
            print(f"[auth] Invite created for admin@apexsports.local token {token[:12]}...")
    except Exception as e:
        print(f"[auth] bootstrap failed: {e}")

# ── WebSocket ─────────────────────────────────────────────────────────────────
try:
    import asyncio
    import json
    from fastapi import WebSocket, WebSocketDisconnect
    from apps.api.websocket import broadcaster

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket):
        await ws.accept()
        q = broadcaster.subscribe()
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
except Exception as e:
    _startup_errors.append(f"websocket: {e}")

# ── Log startup status ────────────────────────────────────────────────────────
@app.on_event("startup")
async def _log_startup():
    if _startup_errors:
        print(f"[startup] {_startup_errors.__len__()} deferred errors:")
        for err in _startup_errors:
            print(f"  - {err}")
    else:
        print("[startup] All modules loaded successfully")
    print(f"[startup] Registered routes: {[getattr(r, 'path', '?') for r in app.routes]}")
