"""Apex Sports — Settings API. Server-side only, masked keys, provider-agnostic."""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["settings"])
SETTINGS_FILE = Path(__file__).parent.parent.parent.parent / "settings.json"

def _mask(key: str) -> str:
    if not key or len(key) < 8:
        return ""
    return f"{'*'*(len(key)-4)}{key[-4:]}"

def _is_masked(k: str) -> bool:
    return not k or k.startswith('*') or '•' in k

def _use_supabase() -> bool:
    try:
        from database.supabase_client import is_configured
        return is_configured()
    except Exception:
        return False

def _load() -> dict[str, Any]:
    # Always read from local file first (written by every save)
    file_data = {}
    if SETTINGS_FILE.exists():
        try:
            file_data = json.loads(SETTINGS_FILE.read_text())
        except Exception:
            pass
    # Also try Supabase (survives Render deploys)
    if _use_supabase():
        try:
            from database.supabase_client import select_one
            row = select_one("app_settings", {"key": "main"})
            if row and row.get("data"):
                data = row["data"]
                sb_data = data if isinstance(data, dict) else json.loads(data)
                return {**file_data, **sb_data}
        except Exception as e:
            print(f"[settings] Supabase load failed (using file): {e}")
    return file_data

def _save(data: dict[str, Any]) -> None:
    # Always write to local file (immediate, reliable)
    SETTINGS_FILE.write_text(json.dumps(data, indent=2, default=str))
    # Also persist to Supabase (survives Render deploys)
    if _use_supabase():
        try:
            from database.supabase_client import upsert
            upsert("app_settings", {"key": "main", "data": data}, on_conflict="key")
        except Exception as e:
            print(f"[settings] Supabase save failed (file still saved): {e}")
    else:
        SETTINGS_FILE.write_text(json.dumps(data, indent=2, default=str))

class ProviderKeys(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class LLMProviderConfig(BaseModel):
    api_key: Optional[str] = None
    selected_model: Optional[str] = None
    base_url: Optional[str] = None

class LLMKeys(BaseModel):
    openai: Optional[LLMProviderConfig] = None
    anthropic: Optional[LLMProviderConfig] = None
    gemini: Optional[LLMProviderConfig] = None
    groq: Optional[LLMProviderConfig] = None
    openrouter: Optional[LLMProviderConfig] = None
    huggingface: Optional[LLMProviderConfig] = None
    agents: Optional[dict[str, bool]] = None

class RiskConfig(BaseModel):
    max_risk_per_slip_pct: Optional[float] = None
    max_daily_loss_pct: Optional[float] = None
    max_open_slips: Optional[int] = None
    min_confidence_threshold: Optional[float] = None
    min_edge_threshold: Optional[float] = None

class ScannerConfig(BaseModel):
    interval_seconds: Optional[int] = None
    top_n: Optional[int] = None

class SettingsUpdate(BaseModel):
    sportmonks: Optional[ProviderKeys] = None
    api_football: Optional[ProviderKeys] = None
    sportradar: Optional[ProviderKeys] = None
    the_odds_api: Optional[ProviderKeys] = None
    llm: Optional[LLMKeys] = None
    risk: Optional[RiskConfig] = None
    scanner: Optional[ScannerConfig] = None

def _mask_providers(raw: dict) -> dict:
    # Support odds_api alias
    if "the_odds_api" in raw and "odds_api" not in raw:
        raw = {**raw, "odds_api": raw["the_odds_api"]}
    out = {}
    for p in ["sportmonks","api_football","sportradar","the_odds_api"]:
        # the_odds_api maps to odds_api internally
        lookup = "odds_api" if p == "the_odds_api" else p
        cfg = raw.get(p, {}) or raw.get(lookup, {})
        if p == "the_odds_api":
            cfg = raw.get("the_odds_api", {}) or raw.get("odds_api", {})
        out[p] = {
            "api_key": _mask(cfg.get("api_key","")),
            "has_key": bool(cfg.get("api_key")),
            "base_url": cfg.get("base_url",""),
            "display_name": p.replace("_"," ").title()
        }
    return out

DEFAULT_LLM_BASES = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com",
    "openrouter": "https://openrouter.ai/api/v1",
    "huggingface": "https://router.huggingface.co/v1",
    "gemini": "https://generativelanguage.googleapis.com",
    "groq": "https://api.groq.com/openai/v1",
}

def _mask_llm(raw: dict) -> dict:
    llm = raw.get("llm", {})
    out = {}
    for p in ["openai","anthropic","gemini","groq","openrouter","huggingface"]:
        cfg = llm.get(p, {})
        if isinstance(cfg, dict):
            # normalize huggingface router without /v1 to include /v1
            base = cfg.get("base_url") or DEFAULT_LLM_BASES.get(p, "")
            if p == "huggingface" and base.rstrip("/") == "https://router.huggingface.co":
                base = "https://router.huggingface.co/v1"
            out[p] = {"api_key": _mask(cfg.get("api_key","")), "has_key": bool(cfg.get("api_key")), "selected_model": cfg.get("selected_model",""), "base_url": base}
        else:
            out[p] = {"api_key": "", "has_key": False, "selected_model": "", "base_url": DEFAULT_LLM_BASES.get(p, "")}
    return out

@router.get("")
async def get_settings():
    raw = _load()
    return {
        "providers": _mask_providers(raw),
        "llm": _mask_llm(raw),
        "risk": raw.get("risk", {}),
        "scanner": raw.get("scanner", {}),
        "sports": ["football","basketball"],
    }

@router.get("/market-data")
async def get_market_data():
    raw = _load()
    return {"providers": _mask_providers(raw)}

@router.put("/market-data")
async def put_market_data(update: dict):
    raw = _load()
    for p in ["sportmonks","api_football","sportradar","the_odds_api"]:
        if p in update:
            cfg = raw.setdefault(p, {})
            data = update[p] or {}
            if data.get("api_key") and not _is_masked(data["api_key"]):
                cfg["api_key"] = data["api_key"]
            if data.get("base_url"):
                # Guard: if base_url looks like a key (no http, long alphanumeric), ignore and warn
                bu = str(data["base_url"]).strip()
                if bu and not bu.startswith("http"):
                    # likely user pasted key into base_url field — ignore
                    continue
                cfg["base_url"] = bu
    _save(raw)
    try:
        from core.config.settings import invalidate_runtime
        invalidate_runtime()
    except Exception:
        pass
    return {"status":"ok"}

# ─── LLM helpers ───────────────────────────────────────────────────────────
def _get_llm_key(raw: dict, provider: str) -> str:
    llm = raw.get("llm", {})
    cfg = llm.get(provider, {})
    if isinstance(cfg, dict) and cfg.get("api_key"):
        return cfg["api_key"]
    return llm.get(f"{provider}_api_key", "")

async def _fetch_openai_models(api_key: str) -> list[dict]:
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {api_key}"})
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data.get("data", []):
            mid = m.get("id","")
            is_paid = any(x in mid for x in ["gpt-4","o1","o3","o4"])
            models.append({"id": mid, "name": mid, "is_free": not is_paid, "is_paid": is_paid, "provider": "openai"})
        return sorted(models, key=lambda x: x["id"])

async def _fetch_anthropic_models(api_key: str) -> list[dict]:
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://api.anthropic.com/v1/models", headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data.get("data", []):
            models.append({"id": m.get("id",""), "name": m.get("id",""), "is_free": False, "is_paid": True, "provider": "anthropic"})
        return sorted(models, key=lambda x: x["id"])

async def _fetch_gemini_models(api_key: str) -> list[dict]:
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}")
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data.get("models", []):
            name = m.get("name","").replace("models/","")
            is_free = "flash" in name.lower()
            models.append({"id": name, "name": m.get("displayName", name), "is_free": is_free, "is_paid": not is_free, "provider": "gemini"})
        return sorted(models, key=lambda x: x["id"])

async def _fetch_groq_models(api_key: str) -> list[dict]:
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {api_key}"})
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data.get("data", []):
            mid = m.get("id","")
            models.append({"id": mid, "name": mid, "is_free": True, "is_paid": False, "provider": "groq"})
        return sorted(models, key=lambda x: x["id"])

async def _fetch_openrouter_models(api_key: str) -> list[dict]:
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://openrouter.ai/api/v1/models", headers={"Authorization": f"Bearer {api_key}"})
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data.get("data", []):
            mid = m.get("id","")
            pricing = m.get("pricing", {})
            prompt_price = float(pricing.get("prompt","0") or "0")
            completion_price = float(pricing.get("completion","0") or "0")
            is_free = prompt_price == 0 and completion_price == 0
            models.append({"id": mid, "name": m.get("name", mid), "is_free": is_free, "is_paid": not is_free, "provider": "openrouter"})
        return sorted(models, key=lambda x: x["id"])

async def _fetch_huggingface_models(api_key: str) -> list[dict]:
    import httpx
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://huggingface.co/api/models", headers={"Authorization": f"Bearer {api_key}"}, params={"limit": 100, "sort": "downloads", "direction": "-1", "filter": "text-generation"})
        resp.raise_for_status()
        data = resp.json()
        models = []
        for m in data:
            mid = m.get("id","")
            models.append({"id": mid, "name": mid, "is_free": True, "is_paid": False, "provider": "huggingface", "downloads": m.get("downloads",0), "likes": m.get("likes",0)})
        return sorted(models, key=lambda x: x.get("downloads",0), reverse=True)

MODEL_FETCHERS = {
    "openai": _fetch_openai_models,
    "anthropic": _fetch_anthropic_models,
    "gemini": _fetch_gemini_models,
    "groq": _fetch_groq_models,
    "openrouter": _fetch_openrouter_models,
    "huggingface": _fetch_huggingface_models,
}

@router.get("/ai")
async def get_ai():
    raw = _load()
    llm = raw.get("llm", {})
    # agents default: all enabled
    default_agents = {k: True for k in ["form_sentinel","team_strength","player_availability","matchup_analyst","market_analyst","strategy_ensemble","pace_tempo","shooting_efficiency","rebound_rim","availability_fatigue","matchup_scheme","market_efficiency"]}
    agents = llm.get("agents", default_agents) if isinstance(llm.get("agents"), dict) else default_agents
    return {"providers": _mask_llm(raw), "agents": agents}

@router.put("/ai")
async def put_ai(update: dict):
    # Accept both {providers:{...}} (ApexLoop style) and flat {openai:{...}} (legacy)
    raw = _load()
    llm = raw.setdefault("llm", {})
    # Normalize body
    body = update
    providers_dict = body.get("providers") if "providers" in body else body
    # providers
    for p in ["openai","anthropic","gemini","groq","openrouter","huggingface"]:
        cfg = None
        if isinstance(providers_dict, dict):
            cfg = providers_dict.get(p)
        if cfg is None:
            # also check legacy flat
            cfg = body.get(p)
        if cfg is not None and isinstance(cfg, dict):
            prov = llm.setdefault(p, {})
            if cfg.get("api_key") is not None and not _is_masked(str(cfg.get("api_key"))):
                prov["api_key"] = cfg["api_key"]
            if cfg.get("selected_model") is not None:
                prov["selected_model"] = cfg["selected_model"]
            if cfg.get("base_url") is not None:
                bu = str(cfg["base_url"]).strip()
                if p == "huggingface" and bu.rstrip("/") == "https://router.huggingface.co":
                    bu = "https://router.huggingface.co/v1"
                prov["base_url"] = bu
    # agents toggle
    agents = body.get("agents")
    if agents is not None and isinstance(agents, dict):
        llm["agents"] = {k: bool(v) for k,v in agents.items()}
    _save(raw)
    try:
        from core.config.settings import invalidate_runtime
        invalidate_runtime()
    except Exception:
        pass
    return {"status":"ok"}

@router.put("")
async def update_settings(update: SettingsUpdate):
    raw = _load()
    if update.sportmonks:
        cfg = raw.setdefault("sportmonks", {})
        if update.sportmonks.api_key and not _is_masked(update.sportmonks.api_key):
            cfg["api_key"] = update.sportmonks.api_key
        if update.sportmonks.base_url: cfg["base_url"]=update.sportmonks.base_url
    if update.api_football:
        cfg = raw.setdefault("api_football", {})
        if update.api_football.api_key and not _is_masked(update.api_football.api_key):
            cfg["api_key"] = update.api_football.api_key
        if update.api_football.base_url: cfg["base_url"]=update.api_football.base_url
    if update.sportradar:
        cfg = raw.setdefault("sportradar", {})
        if update.sportradar.api_key and not _is_masked(update.sportradar.api_key):
            cfg["api_key"] = update.sportradar.api_key
        if update.sportradar.base_url: cfg["base_url"]=update.sportradar.base_url
    if update.the_odds_api:
        cfg = raw.setdefault("the_odds_api", {})
        if update.the_odds_api.api_key and not _is_masked(update.the_odds_api.api_key):
            cfg["api_key"] = update.the_odds_api.api_key
        if update.the_odds_api.base_url: cfg["base_url"]=update.the_odds_api.base_url
    if update.llm:
        llm = raw.setdefault("llm", {})
        for p in ["openai","anthropic","gemini","groq","openrouter","huggingface"]:
            cfg = getattr(update.llm, p, None)
            if cfg is not None:
                prov = llm.setdefault(p, {})
                if cfg.api_key and not _is_masked(cfg.api_key):
                    prov["api_key"]=cfg.api_key
                if cfg.selected_model: prov["selected_model"]=cfg.selected_model
    if update.risk:
        risk = raw.setdefault("risk", {})
        for k,v in update.risk.model_dump(exclude_none=True).items():
            risk[k]=v
    if update.scanner:
        sc = raw.setdefault("scanner", {})
        for k,v in update.scanner.model_dump(exclude_none=True).items():
            sc[k]=v
    _save(raw)
    try:
        from core.config.settings import invalidate_runtime
        invalidate_runtime()
    except Exception:
        pass
    return {"status":"ok"}

@router.get("/models/{provider}")
async def fetch_models(provider: str):
    if provider not in MODEL_FETCHERS:
        raise HTTPException(400, f"Unknown provider: {provider}. Supported: {list(MODEL_FETCHERS.keys())}")
    raw = _load()
    api_key = _get_llm_key(raw, provider)
    if not api_key:
        raise HTTPException(400, f"{provider} API key not configured. Save a key first.")
    try:
        models = await MODEL_FETCHERS[provider](api_key)
        return {"provider": provider, "models": models, "count": len(models)}
    except Exception as e:
        import httpx
        if isinstance(e, httpx.HTTPStatusError):
            return {"provider": provider, "models": [], "count": 0, "error": f"API returned {e.response.status_code}: {e.response.text[:200]}"}
        return {"provider": provider, "models": [], "count": 0, "error": str(e)}

@router.post("/test/{provider}")
async def test_provider(provider: str, body: dict = {}):
    raw = _load()
    key = body.get("api_key")
    if not key or _is_masked(key):
        if provider in ["sportmonks","api_football","sportradar","the_odds_api"]:
            key = raw.get(provider, {}).get("api_key","")
        else:
            key = _get_llm_key(raw, provider)
    if not key:
        return {"status":"error","message": f"{provider} API key not configured — paste key above and SAVE first, then TEST"}
    # Sports providers: test directly against real API (no adapter cache dependency)
    if provider == "sportmonks":
        import httpx
        base = (raw.get("sportmonks",{}).get("base_url") or "https://api.sportmonks.com/v3").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/football/leagues", params={"api_token": key, "per_page": 1})
                if resp.status_code == 200:
                    return {"status": "ok", "message": "Sportmonks connected — API key valid", "configured": True}
                if resp.status_code in (401, 403):
                    return {"status": "error", "message": f"Auth failed ({resp.status_code}) — check key at my.sportmonks.com", "configured": False}
                return {"status": "error", "message": f"HTTP {resp.status_code}: {resp.text[:120]}", "configured": False}
        except Exception as e:
            return {"status": "error", "message": str(e), "configured": False}
    if provider == "api_football":
        import httpx
        base = (raw.get("api_football",{}).get("base_url") or "https://v3.football.api-sports.io").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/leagues", headers={"x-apisports-key": key}, params={"type": "league"})
                if resp.status_code == 200:
                    return {"status": "ok", "message": "API-Football connected — API key valid", "configured": True}
                if resp.status_code in (401, 403):
                    return {"status": "error", "message": f"Auth failed ({resp.status_code}) — check key at api-football.com", "configured": False}
                return {"status": "error", "message": f"HTTP {resp.status_code}: {resp.text[:120]}", "configured": False}
        except Exception as e:
            return {"status": "error", "message": str(e), "configured": False}
    if provider == "sportradar":
        import httpx
        base = (raw.get("sportradar",{}).get("base_url") or "https://api.sportradar.com").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/soccer/trial/v4/en/leagues.json", params={"api_key": key})
                if resp.status_code == 200:
                    return {"status": "ok", "message": "Sportradar connected — API key valid", "configured": True}
                if resp.status_code in (401, 403):
                    return {"status": "error", "message": f"Auth failed ({resp.status_code}) — check key at sportradar.com", "configured": False}
                return {"status": "error", "message": f"HTTP {resp.status_code}: {resp.text[:120]}", "configured": False}
        except Exception as e:
            return {"status": "error", "message": str(e), "configured": False}
    if provider == "the_odds_api":
        import httpx
        base = (raw.get("the_odds_api",{}).get("base_url") or "https://api.the-odds-api.com/v4").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/sports", params={"apiKey": key})
                if resp.status_code == 200:
                    return {"status": "ok", "message": "The Odds API connected — API key valid", "configured": True}
                if resp.status_code in (401, 403):
                    return {"status": "error", "message": f"Auth failed ({resp.status_code}) — check key at the-odds-api.com", "configured": False}
                return {"status": "error", "message": f"HTTP {resp.status_code}: {resp.text[:120]}", "configured": False}
        except Exception as e:
            return {"status": "error", "message": str(e), "configured": False}
    # LLM providers: test via model fetch (proves key + endpoint)
    if provider in MODEL_FETCHERS:
        try:
            models = await MODEL_FETCHERS[provider](key)
            return {"status": "ok", "message": f"Connected. {len(models)} models available.", "model_count": len(models)}
        except Exception as e:
            return {"status": "error","message":str(e)}
    return {"status":"error","message":f"{provider} not recognized — cannot validate key"}

@router.get("/risk")
async def get_risk():
    raw = _load()
    return raw.get("risk", {})

@router.put("/risk")
async def put_risk(cfg: RiskConfig):
    raw = _load()
    risk = raw.setdefault("risk", {})
    for k,v in cfg.model_dump(exclude_none=True).items():
        risk[k]=v
    _save(raw)
    return {"status":"ok"}

# ─── Generic sections (adapted from ApexLoop) ───────────────────────────────
# ApexLoop sections: account, profile, trading→strategy, brokers→sportsbooks, notifications, distribution, integrations, subscription, security, appearance, advanced
GENERIC_SECTIONS = ["account","profile","strategy","sportsbooks","notifications","distribution","integrations","subscription","security","appearance","advanced","trading"]

for _sec in GENERIC_SECTIONS:
    pass  # placeholder for docs

@router.get("/account")
async def get_account():
    raw = _load()
    return raw.get("account", {})

@router.put("/account")
async def put_account(body: dict):
    raw = _load()
    acc = raw.setdefault("account", {})
    for k,v in (body or {}).items():
        acc[k]=v
    _save(raw)
    return {"status":"ok"}

@router.get("/profile")
async def get_profile():
    raw = _load()
    return raw.get("profile", {})

@router.put("/profile")
async def put_profile(body: dict):
    raw = _load()
    prof = raw.setdefault("profile", {})
    for k,v in (body or {}).items():
        prof[k]=v
    _save(raw)
    return {"status":"ok"}

@router.get("/sportsbooks")
async def get_sportsbooks():
    raw = _load()
    return raw.get("sportsbooks", {"enabled":["sportybet","bet9ja"], "priority":["sportybet","bet9ja","betway","generic"]})

@router.put("/sportsbooks")
async def put_sportsbooks(body: dict):
    raw = _load()
    raw["sportsbooks"] = body
    _save(raw)
    return {"status":"ok"}

@router.get("/notifications")
async def get_notifications():
    raw = _load()
    return raw.get("notifications", {"channels":{"in_app":True,"email":False,"push":False,"telegram":False,"whatsapp":False},"events":{"prediction_generated":True,"value_detected":True,"risk_blocked":True,"provider_failure":True}})

@router.put("/notifications")
async def put_notifications(body: dict):
    raw = _load()
    raw["notifications"] = body
    _save(raw)
    return {"status":"ok"}

@router.get("/distribution")
async def get_distribution():
    raw = _load()
    return raw.get("distribution", {"channels":["in_app"],"telegram_bot_token": _mask(raw.get("distribution",{}).get("telegram_bot_token","")),"has_telegram": bool(raw.get("distribution",{}).get("telegram_bot_token"))})

@router.put("/distribution")
async def put_distribution(body: dict):
    raw = _load()
    dist = raw.setdefault("distribution", {})
    for k,v in body.items():
        if k=="telegram_bot_token" and _is_masked(str(v)): continue
        dist[k]=v
    _save(raw)
    return {"status":"ok"}

@router.get("/integrations")
async def get_integrations():
    raw = _load()
    return raw.get("integrations", {"webhooks":[],"the_odds_api_base":"https://api.the-odds-api.com/v4"})

@router.put("/integrations")
async def put_integrations(body: dict):
    raw = _load()
    raw["integrations"] = body
    _save(raw)
    return {"status":"ok"}

@router.get("/subscription")
async def get_subscription():
    raw = _load()
    return raw.get("subscription", {"plan":"pro","status":"active","period":"monthly"})

@router.put("/subscription")
async def put_subscription(body: dict):
    raw = _load()
    raw["subscription"]=body
    _save(raw)
    return {"status":"ok"}

@router.get("/security")
async def get_security():
    raw = _load()
    sec = raw.get("security", {})
    return {"two_factor": sec.get("two_factor", False), "session_timeout": sec.get("session_timeout", 60), "has_password": True}

@router.put("/security")
async def put_security(body: dict):
    raw = _load()
    sec = raw.setdefault("security", {})
    for k,v in body.items():
        # never store raw password in plain? mock
        sec[k]=v
    _save(raw)
    return {"status":"ok"}

@router.get("/appearance")
async def get_appearance():
    raw = _load()
    return raw.get("appearance", {"theme":"dark","accent":"emerald","density":"comfortable","animations":"enabled","sidebar_auto_collapse":False})

@router.put("/appearance")
async def put_appearance(body: dict):
    raw = _load()
    raw["appearance"]=body
    _save(raw)
    return {"status":"ok"}

@router.get("/advanced")
async def get_advanced():
    raw = _load()
    return raw.get("advanced", {"debug": True, "log_level":"INFO","cache_ttl": 60})

@router.put("/advanced")
async def put_advanced(body: dict):
    raw = _load()
    raw["advanced"]=body
    _save(raw)
    return {"status":"ok"}

@router.get("/strategy")
async def get_strategy():
    raw = _load()
    return raw.get("strategy", {"sport_focus":"football","scanner_aggressiveness":"balanced","market_filters":["MONEYLINE","MATCH_RESULT","SPREAD","TOTAL_POINTS"]})

@router.put("/strategy")
async def put_strategy(body: dict):
    raw = _load()
    raw["strategy"]=body
    _save(raw)
    return {"status":"ok"}

@router.get("/brokers")
async def get_brokers_alias():
    # alias for sportsbooks for backward compat with ApexLoop naming
    return await get_sportsbooks()

