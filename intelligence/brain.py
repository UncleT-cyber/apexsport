"""Unified ApexSports AI Brain — sport-aware single source of truth.

CRITICAL: Prompt resolution MUST be sport-aware:
    get_prompt(sport="football", specialist="form", version="v1")
    get_prompt(sport="basketball", specialist="form", version="v1")
    → must resolve to different prompt assets.

Never silently fall back to a generic football prompt for another sport.
If sport/specialist prompt does not exist: STATUS = NOT_IMPLEMENTED.

Persisted in settings.json via /api/settings/ai:
  llm.agents: {agent_name: bool}
  llm.{provider}.selected_model: string
  llm.{provider}.base_url, api_key
  llm.prompt_versions: {sport:specialist:version or specialist:version} (legacy compat)

No hardcoded model names. The brain reads live settings and serves the engine.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

DEFAULT_AGENTS = [
    "form_sentinel",
    "team_strength",
    "player_availability",
    "matchup_analyst",
    "market_analyst",
    "strategy_ensemble",
    "pace_tempo",
    "shooting_efficiency",
    "rebound_rim",
    "availability_fatigue",
    "matchup_scheme",
    "market_efficiency",
]

# Sport → specialists mapping (shared interface, sport-specific intelligence)
SPORT_SPECIALISTS: dict[str, list[str]] = {
    "football": ["form_sentinel", "team_strength", "player_availability", "matchup_analyst", "market_analyst", "strategy_ensemble"],
    "basketball": ["pace_tempo", "shooting_efficiency", "rebound_rim", "availability_fatigue", "matchup_scheme", "market_efficiency"],
}

# Reverse map: specialist → sport (for lookup when only specialist known)
SPECIALIST_SPORT: dict[str, str] = {}
for sport, specs in SPORT_SPECIALISTS.items():
    for s in specs:
        SPECIALIST_SPORT[s] = sport


def register_sport_specialists(sport: str, specialists: list[str]) -> None:
    """Extensibility hook: register specialists for a new sport (e.g. tennis).

    Example:
        register_sport_specialists("tennis", ["form_serve","baseline_power","availability_fitness",...])
    """
    SPORT_SPECIALISTS[sport] = list(specialists)
    for s in specialists:
        SPECIALIST_SPORT[s] = sport
    # Extend DEFAULT_AGENTS for status reporting (no duplicates)
    for s in specialists:
        if s not in DEFAULT_AGENTS:
            DEFAULT_AGENTS.append(s)


def specialists_for_sport(sport: str) -> list[str]:
    return list(SPORT_SPECIALISTS.get(sport, []))


def sport_for_specialist(specialist_id: str) -> Optional[str]:
    return SPECIALIST_SPORT.get(specialist_id)


def _load_raw() -> dict:
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text())
        except Exception:
            return {}
    return {}


def get_enabled_agents() -> dict[str, bool]:
    raw = _load_raw()
    agents = raw.get("llm", {}).get("agents")
    if isinstance(agents, dict):
        return {k: bool(agents.get(k, True)) for k in DEFAULT_AGENTS}
    return {k: True for k in DEFAULT_AGENTS}


def is_agent_enabled(name: str) -> bool:
    return get_enabled_agents().get(name, True)


def get_active_llm() -> Optional[dict]:
    """Return {provider, model, base_url, api_key} for the first configured provider with selected_model."""
    raw = _load_raw()
    llm = raw.get("llm", {})
    order = ["openai", "anthropic", "openrouter", "huggingface", "gemini", "groq"]
    for provider in order:
        cfg = llm.get(provider, {})
        if isinstance(cfg, dict) and cfg.get("api_key") and cfg.get("selected_model"):
            base = cfg.get("base_url") or {
                "openai": "https://api.openai.com/v1",
                "anthropic": "https://api.anthropic.com",
                "openrouter": "https://openrouter.ai/api/v1",
                "huggingface": "https://router.huggingface.co/v1",
                "gemini": "https://generativelanguage.googleapis.com",
                "groq": "https://api.groq.com/openai/v1",
            }.get(provider, "")
            if provider == "huggingface" and base.rstrip("/") == "https://router.huggingface.co":
                base = "https://router.huggingface.co/v1"
            return {
                "provider": provider,
                "model": cfg["selected_model"],
                "base_url": base,
                "api_key_masked": cfg["api_key"][-4:] if len(cfg["api_key"]) >= 4 else "***",
                "has_key": True,
            }
    return None


def get_specialist_config(specialist_id: str, sport: Optional[str] = None, prompt_version: Optional[str] = None) -> dict:
    """Resolve specialist → model → provider → prompt_version → template.

    Sport-aware: sport + specialist + version → prompt asset.
    If sport is None, infer from specialist mapping (football vs basketball).

    Never silently falls back to generic football prompt for another sport.
    If prompt does not exist for sport/specialist: prompt_status = NOT_IMPLEMENTED, template = "".

    Specialist's structured output will be validated against AgentOutput (shared contract).
    """
    active = get_active_llm()
    raw = _load_raw()
    inferred_sport = sport or sport_for_specialist(specialist_id) or "football"

    # Prompt version: priority → explicit arg > settings sport:specialist:version > specialist:version > default v1
    prompt_versions = raw.get("llm", {}).get("prompt_versions", {})
    # Try sport-qualified key first: "football:form_sentinel"
    resolved_version = prompt_version or prompt_versions.get(f"{inferred_sport}:{specialist_id}") or prompt_versions.get(specialist_id, "v1")

    template = ""
    prompt_status = "not_implemented"
    resolved_path = f"{inferred_sport}/{specialist_id}/{resolved_version}"

    try:
        from intelligence.prompts.registry import prompt_registry

        # Sport-aware resolution — never cross-fallback
        pv, status = prompt_registry.resolve(inferred_sport, specialist_id, resolved_version)
        if pv:
            template = pv.template
            resolved_version = pv.version
            prompt_status = status
            resolved_path = pv.path
        else:
            # Try active for sport/specialist if exact version missing — still sport-scoped
            pv2, status2 = prompt_registry.resolve_active(inferred_sport, specialist_id)
            if pv2 and resolved_version == "v1":
                # Only use active if caller asked for default v1 and active exists for that sport
                template = pv2.template
                resolved_version = pv2.version
                prompt_status = status2
                resolved_path = pv2.path
            else:
                prompt_status = "not_implemented"
                template = ""
    except Exception:
        template = ""
        prompt_status = "not_implemented"

    return {
        "specialist": specialist_id,
        "sport": inferred_sport,
        "prompt_path": resolved_path,
        "prompt_status": prompt_status,
        "provider": active["provider"] if active else "none",
        "model": active["model"] if active else "stub-deterministic",
        "model_version": "v1",
        "prompt_version": resolved_version,
        "prompt_template": template,
        "base_url": active["base_url"] if active else "",
        "is_configured": active is not None,
        "is_implemented": prompt_status == "available",
    }


def get_brain_status() -> dict:
    enabled = get_enabled_agents()
    active = get_active_llm()
    raw = _load_raw()
    prompt_versions = raw.get("llm", {}).get("prompt_versions", {})
    # Include sport-aware prompt paths for observability (dynamic across all registered sports)
    sport_paths: dict[str, str] = {}
    try:
        from intelligence.prompts.registry import prompt_registry

        for sport in list(SPORT_SPECIALISTS.keys()):
            for spec in specialists_for_sport(sport):
                pv, status = prompt_registry.resolve_active(sport, spec)
                sport_paths[f"{sport}/{spec}"] = pv.path if pv else f"{sport}/{spec}/v1 (NOT_IMPLEMENTED)"
    except Exception:
        pass

    return {
        "enabled_agents": [k for k, v in enabled.items() if v],
        "disabled_agents": [k for k, v in enabled.items() if not v],
        "total_agents": len(DEFAULT_AGENTS),
        "enabled_count": sum(1 for v in enabled.values() if v),
        "active_llm": active,
        "is_configured": active is not None,
        "prompt_versions": {k: prompt_versions.get(k, "v1") for k in DEFAULT_AGENTS},
        "prompt_paths": sport_paths,
        "sport_specialists": SPORT_SPECIALISTS,
    }
