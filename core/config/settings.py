"""Apex Sports — Core configuration (mirrors ApexLoop pattern, sport-adapted)."""
from __future__ import annotations

import json
import threading
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SETTINGS_FILE = Path(__file__).parent.parent.parent / "settings.json"


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DATABASE_")
    url: str = "postgresql+asyncpg://apexsport:apexsport@localhost:5432/apexsport"
    pool_size: int = 20
    max_overflow: int = 10
    echo: bool = False


class RedisSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="REDIS_")
    url: str = "redis://localhost:6379/0"


class AuthSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JWT_")
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    expiration_minutes: int = 1440


class SportmonksSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SPORTMONKS_")
    api_key: str = ""
    base_url: str = "https://api.sportmonks.com/v3"


class ApiFootballSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="API_FOOTBALL_")
    api_key: str = ""
    base_url: str = "https://v3.football.api-sports.io"


class SportradarSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SPORTRADAR_")
    api_key: str = ""
    base_url: str = "https://api.sportradar.com"


class OddsApiSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ODDS_API_")
    api_key: str = ""
    base_url: str = "https://api.the-odds-api.com/v4"


class LLMSettings(BaseSettings):
    model_config = SettingsConfigDict(extra="allow")
    openai_api_key: str = ""
    openai_model: str = ""
    anthropic_api_key: str = ""
    anthropic_model: str = ""
    gemini_api_key: str = ""
    gemini_model: str = ""
    groq_api_key: str = ""
    groq_model: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = ""
    huggingface_api_key: str = ""
    huggingface_model: str = ""


class RiskSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RISK_")
    max_risk_per_slip_pct: float = 2.0
    max_daily_loss_pct: float = 5.0
    max_open_slips: int = 10
    min_confidence_threshold: float = 0.40
    min_edge_threshold: float = 0.03


class SupabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SUPABASE_")
    url: str = ""
    anon_key: str = ""
    service_role_key: str = ""
    jwt_secret: str = ""


class ScannerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SCAN_")
    interval_seconds: int = 300
    max_candidates: int = 50
    top_n: int = 10
    min_confidence_threshold: float = 0.55


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APEXSPORT_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    env: Environment = Environment.DEVELOPMENT
    secret_key: str = "change-me-in-production"
    debug: bool = True
    log_level: str = "INFO"
    database: DatabaseSettings = DatabaseSettings()
    redis: RedisSettings = RedisSettings()
    auth: AuthSettings = AuthSettings()
    supabase: SupabaseSettings = SupabaseSettings()
    sportmonks: SportmonksSettings = SportmonksSettings()
    api_football: ApiFootballSettings = ApiFootballSettings()
    sportradar: SportradarSettings = SportradarSettings()
    odds_api: OddsApiSettings = OddsApiSettings()
    llm: LLMSettings = LLMSettings()
    risk: RiskSettings = RiskSettings()
    scanner: ScannerSettings = ScannerSettings()
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "https://apexsport.onrender.com", "https://apexsports-api.onrender.com"]
    frontend_url: str = ""  # Render Static Site URL for CORS (e.g., https://apexsports.onrender.com)
    api_url: str = ""  # Backend URL for frontend (VITE_API_URL, e.g., https://api.apexsports.onrender.com)

    @property
    def is_testing(self) -> bool:
        return self.env == Environment.TESTING


@lru_cache
def get_settings() -> Settings:
    return Settings()


_runtime_settings: Settings | None = None
_runtime_lock = threading.Lock()


def _load_settings_file() -> dict[str, Any]:
    # Always read from local file first (written by every save)
    file_data = {}
    if SETTINGS_FILE.exists():
        try:
            file_data = json.loads(SETTINGS_FILE.read_text())
        except Exception:
            pass
    # Also try Supabase (survives Render deploys)
    try:
        from database.supabase_client import is_configured, select_one
        if is_configured():
            row = select_one("app_settings", {"key": "main"})
            if row and row.get("data"):
                data = row["data"]
                sb_data = data if isinstance(data, dict) else json.loads(data)
                # Merge: Supabase overrides file (Supabase is source of truth across deploys)
                return {**file_data, **sb_data}
    except Exception:
        pass
    return file_data


def _build_runtime_settings() -> Settings:
    raw = _load_settings_file()
    overrides: dict[str, Any] = {}
    # Provider overrides from settings.json if present (support both odds_api and the_odds_api aliases)
    # Handle the_odds_api alias → odds_api
    if "the_odds_api" in raw and "odds_api" not in raw:
        raw["odds_api"] = raw["the_odds_api"]
    elif "the_odds_api" in raw and "odds_api" in raw:
        # merge: prefer odds_api, but fill missing from the_odds_api
        for k,v in raw["the_odds_api"].items():
            raw["odds_api"].setdefault(k, v)
    for key, cls in [
        ("sportmonks", SportmonksSettings),
        ("api_football", ApiFootballSettings),
        ("sportradar", SportradarSettings),
        ("odds_api", OddsApiSettings),
    ]:
        data = raw.get(key, {})
        if data.get("api_key") and not str(data["api_key"]).startswith("*"):
            overrides[key] = cls(**{k: v for k, v in data.items() if hasattr(cls, k) or k in cls.model_fields})
    llm = raw.get("llm", {})
    if llm:
        # flat or nested
        flat = {}
        for p in ["openai", "anthropic", "gemini", "groq", "openrouter"]:
            prov = llm.get(p, {})
            if isinstance(prov, dict) and prov.get("api_key") and not str(prov["api_key"]).startswith("*"):
                flat[f"{p}_api_key"] = prov["api_key"]
            if isinstance(prov, dict) and prov.get("selected_model"):
                flat[f"{p}_model"] = prov["selected_model"]
        for k in ["openai_api_key", "anthropic_api_key", "openai_model"]:
            if k in llm and llm[k] and not str(llm[k]).startswith("*"):
                flat[k] = llm[k]
        if flat:
            base = LLMSettings()
            overrides["llm"] = LLMSettings(**{**base.model_dump(), **flat})
    risk = raw.get("risk", {})
    if risk:
        overrides["risk"] = RiskSettings(**{k: v for k, v in risk.items() if k in RiskSettings.model_fields})
    scanner = raw.get("scanner", {})
    if scanner:
        overrides["scanner"] = ScannerSettings(**{k: v for k, v in scanner.items() if k in ScannerSettings.model_fields})
    if overrides:
        base = Settings()
        return base.model_copy(update=overrides)
    return Settings()


def get_runtime_settings() -> Settings:
    global _runtime_settings
    if _runtime_settings is None:
        with _runtime_lock:
            if _runtime_settings is None:
                _runtime_settings = _build_runtime_settings()
    return _runtime_settings


def invalidate_runtime() -> None:
    global _runtime_settings
    with _runtime_lock:
        _runtime_settings = None
