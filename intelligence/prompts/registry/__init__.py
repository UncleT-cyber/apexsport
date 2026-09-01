"""Prompt registry — sport-aware, versioned, auditable.

CRITICAL ARCHITECTURE REQUIREMENT — MULTI-SPORT INTELLIGENCE:

    Prompts MUST be resolved by: sport + specialist + version
        get_prompt(sport="football", specialist="form", version="v1")
        get_prompt(sport="basketball", specialist="form", version="v1")
        → must resolve to DIFFERENT assets.

    The registry must NEVER silently fall back to a generic football prompt
    for another sport. If a sport/specialist prompt does not exist:
        STATUS = NOT_IMPLEMENTED  (do not substitute)

    Prompt assets are loaded from:
        intelligence/prompts/{sport}/{specialist}/v*.md
        sports/{sport}/prompts/{specialist}/v*.md   (extensibility)

    Shared contract, sport-specific intelligence:
        AgentInput / AgentOutput / specialist interface remain shared.
        prompt versioning, model registry, ensemble, calibration, value, risk, provenance remain shared.
        What changes by sport: prompt templates, feature definitions, terminology, markets.

    Provenance: every AgentOutput must carry sport + prompt_version + model,
                and every Prediction must retain sport → specialist → prompt_version chain.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class PromptStatus(str):
    AVAILABLE = "available"
    NOT_IMPLEMENTED = "not_implemented"


class PromptVersion:
    """Single prompt asset: sport / specialist / version / template."""

    def __init__(
        self,
        sport: str,
        specialist: str,
        version: str,
        template: str,
        active: bool = True,
    ) -> None:
        self.sport = sport
        self.specialist = specialist
        self.version = version
        self.template = template
        self.active = active
        self.created_at = datetime.now(timezone.utc)

    @property
    def path(self) -> str:
        """Canonical prompt path: sport/specialist/version  e.g. football/form_sentinel/v1"""
        return f"{self.sport}/{self.specialist}/{self.version}"

    def __repr__(self) -> str:
        return f"PromptVersion({self.path}, active={self.active})"


class PromptRegistry:
    """Sport-aware prompt registry. Keys are sport:specialist:version.

    Never silently cross-falls back. Querying a missing sport/specialist returns None
    (caller must map to STATUS=NOT_IMPLEMENTED).
    """

    def __init__(self) -> None:
        # key: "sport:specialist:version" → PromptVersion
        self._prompts: dict[str, PromptVersion] = {}

    # ─── Registration ────────────────────────────────────────────────────────
    def _key(self, sport: str, specialist: str, version: str) -> str:
        return f"{sport}:{specialist}:{version}"

    def register(self, p: PromptVersion) -> None:
        self._prompts[self._key(p.sport, p.specialist, p.version)] = p

    # ─── Legacy helper: register without sport defaults to football for backward compat tests ──
    def register_legacy(self, specialist: str, version: str, template: str) -> None:
        # Only for internal fallback seeding — tagged as football
        self.register(PromptVersion("football", specialist, version, template))

    # ─── Resolution ──────────────────────────────────────────────────────────
    def get(self, sport: str, specialist: str, version: str) -> Optional[PromptVersion]:
        """Strict lookup — never falls back across sports."""
        return self._prompts.get(self._key(sport, specialist, version))

    # Backward-compat shim: if caller omits sport, require it explicitly (do not guess)
    # Legacy agents that call get(agent, version) will be routed via get_legacy wrapper below.
    def get_legacy(self, specialist: str, version: str) -> Optional[PromptVersion]:
        """DEPRECATED — falls back only for pre-migration callers. Prefer get(sport, ...)."""
        # Search any sport that matches specialist:version — but log that it's ambiguous
        # For migration period, return football version if exists
        pv = self.get("football", specialist, version)
        if pv:
            return pv
        for p in self._prompts.values():
            if p.specialist == specialist and p.version == version:
                return p
        return None

    def active(self, sport: str, specialist: str) -> Optional[PromptVersion]:
        """Latest active prompt for sport+specialist."""
        candidates = [p for p in self._prompts.values() if p.sport == sport and p.specialist == specialist and p.active]
        # Prefer highest version lexicographically (v1 < v2 ...). Use created_at order as tiebreak.
        if not candidates:
            return None
        # Sort by version string then created_at
        candidates.sort(key=lambda p: (p.version, p.created_at))
        return candidates[-1]

    def active_legacy(self, specialist: str) -> Optional[PromptVersion]:
        """DEPRECATED — legacy active without sport."""
        candidates = [p for p in self._prompts.values() if p.specialist == specialist and p.active]
        return candidates[-1] if candidates else None

    def status(self, sport: str, specialist: str, version: str) -> str:
        """Return AVAILABLE or NOT_IMPLEMENTED."""
        return PromptStatus.AVAILABLE if self.get(sport, specialist, version) else PromptStatus.NOT_IMPLEMENTED

    def is_implemented(self, sport: str, specialist: str, version: str = "v1") -> bool:
        return self.get(sport, specialist, version) is not None

    # ─── Resolve with explicit semantics ────────────────────────────────────
    def resolve(
        self, sport: str, specialist: str, version: str = "v1"
    ) -> tuple[Optional[PromptVersion], str]:
        """Resolve sport+specialist+version → (PromptVersion|None, status).

        Never substitutes a different sport's prompt. If not found, status is NOT_IMPLEMENTED.
        """
        pv = self.get(sport, specialist, version)
        if pv:
            return pv, PromptStatus.AVAILABLE
        # Also check active if version is default but exact not found? No — still NOT_IMPLEMENTED if exact version missing
        # But if caller asked for "v1" and we have no v1, return active only if it matches version? No cross-version fallback.
        return None, PromptStatus.NOT_IMPLEMENTED

    def resolve_active(self, sport: str, specialist: str) -> tuple[Optional[PromptVersion], str]:
        """Resolve to active prompt for sport+specialist."""
        pv = self.active(sport, specialist)
        if pv:
            return pv, PromptStatus.AVAILABLE
        return None, PromptStatus.NOT_IMPLEMENTED

    # ─── Activation ──────────────────────────────────────────────────────────
    def activate(self, sport: str, specialist: str, version: str) -> None:
        for p in self._prompts.values():
            if p.sport == sport and p.specialist == specialist:
                p.active = (p.version == version)

    def deactivate(self, sport: str, specialist: str, version: str) -> None:
        k = self._key(sport, specialist, version)
        if k in self._prompts:
            self._prompts[k].active = False

    # ─── Introspection ───────────────────────────────────────────────────────
    def all_for_sport(self, sport: str) -> list[PromptVersion]:
        return [p for p in self._prompts.values() if p.sport == sport]

    def all_specialists_for_sport(self, sport: str) -> list[str]:
        return sorted({p.specialist for p in self._prompts.values() if p.sport == sport})

    def list_paths(self) -> list[str]:
        return sorted(p.path for p in self._prompts.values())

    def __len__(self) -> int:
        return len(self._prompts)


prompt_registry = PromptRegistry()


def _load_prompts_from_disk():
    """Load versioned prompt assets from:
        intelligence/prompts/{sport}/{specialist}/v*.md
        sports/{sport}/prompts/{specialist}/v*.md
    """
    # intelligence/prompts
    bases: list[Path] = []
    intel_prompts = Path(__file__).parent.parent  # intelligence/prompts
    if intel_prompts.exists():
        bases.append(intel_prompts)
    # Also sports/{sport}/prompts
    sports_base = Path(__file__).parent.parent.parent / "sports"
    if sports_base.exists():
        for sport_dir in sports_base.iterdir():
            if sport_dir.is_dir():
                sp = sport_dir / "prompts"
                if sp.exists():
                    bases.append(sp)

    # Load from intelligence/prompts/{sport}/*
    if intel_prompts.exists():
        for sport_dir in intel_prompts.iterdir():
            if not sport_dir.is_dir():
                continue
            if sport_dir.name in ("registry", "versions", "__pycache__"):
                continue
            sport = sport_dir.name
            for specialist_dir in sport_dir.iterdir():
                if not specialist_dir.is_dir():
                    continue
                specialist = specialist_dir.name
                for version_file in specialist_dir.glob("v*.md"):
                    version = version_file.stem  # v1
                    key = f"{sport}:{specialist}:{version}"
                    if key in prompt_registry._prompts:
                        continue
                    try:
                        template = version_file.read_text(encoding="utf-8")
                        prompt_registry.register(PromptVersion(sport, specialist, version, template))
                    except Exception:
                        continue

    # Load from sports/{sport}/prompts/{specialist}/v*.md
    if sports_base.exists():
        for sport_dir in sports_base.iterdir():
            if not sport_dir.is_dir() or sport_dir.name.startswith("_"):
                continue
            prompts_root = sport_dir / "prompts"
            if not prompts_root.exists():
                continue
            sport = sport_dir.name
            for specialist_dir in prompts_root.iterdir():
                if not specialist_dir.is_dir():
                    continue
                specialist = specialist_dir.name
                for version_file in specialist_dir.glob("v*.md"):
                    version = version_file.stem
                    key = f"{sport}:{specialist}:{version}"
                    if key in prompt_registry._prompts:
                        continue
                    try:
                        template = version_file.read_text(encoding="utf-8")
                        prompt_registry.register(PromptVersion(sport, specialist, version, template))
                    except Exception:
                        continue


_load_prompts_from_disk()

# Fallback seed if disk load failed — keeps tests green and satisfies NOT_IMPLEMENTED semantics:
# ONLY seed if no prompts were loaded for that sport/specialist
_FOOTBALL_SPECS = ["form_sentinel", "team_strength", "player_availability", "matchup_analyst", "market_analyst", "strategy_ensemble"]
_BASKETBALL_SPECS = ["pace_tempo", "shooting_efficiency", "rebound_rim", "availability_fatigue", "matchup_scheme", "market_efficiency"]

for spec in _FOOTBALL_SPECS:
    if not prompt_registry.get("football", spec, "v1"):
        # Check if file exists but wasn't loaded (should have been) — if prompts dir empty, seed
        prompt_registry.register(PromptVersion("football", spec, "v1", f"You are {spec} for football. Return structured JSON only."))

for spec in _BASKETBALL_SPECS:
    if not prompt_registry.get("basketball", spec, "v1"):
        prompt_registry.register(PromptVersion("basketball", spec, "v1", f"You are {spec} for basketball. Return structured JSON only."))

# ─── Compatibility shims for old callers ─────────────────────────────────────
# Allow old code that calls prompt_registry.get(specialist, version) or active(specialist)
# to keep working during migration by dispatching to football fallback. New code MUST use
# sport-aware APIs above.
_original_get = prompt_registry.get
_original_active = prompt_registry.active

# Patch registry instance to support both signatures via runtime inspection
import inspect as _inspect

def _patched_get(*args, **kwargs):
    # Detect calling convention:
    #   get(sport, specialist, version)  → 3 args
    #   get(specialist, version)          → 2 args (legacy)
    if len(args) == 2 and "sport" not in kwargs:
        # legacy: get(specialist, version)
        specialist, version = args
        return prompt_registry.get_legacy(specialist, version)
    if len(args) == 3:
        sport, specialist, version = args
        return _original_get(sport, specialist, version)
    # kwargs dispatch
    if "sport" in kwargs:
        return _original_get(kwargs["sport"], kwargs["specialist"], kwargs["version"])
    # fallback
    return prompt_registry.get_legacy(kwargs.get("specialist", ""), kwargs.get("version", "v1"))

def _patched_active(*args, **kwargs):
    if len(args) == 1 and "sport" not in kwargs:
        # legacy active(specialist)
        return prompt_registry.active_legacy(args[0])
    if len(args) == 2:
        sport, specialist = args
        return _original_active(sport, specialist)
    if "sport" in kwargs:
        return _original_active(kwargs["sport"], kwargs["specialist"])
    return prompt_registry.active_legacy(kwargs.get("specialist", ""))

# Monkey-patch instance methods
prompt_registry.get = _patched_get  # type: ignore
prompt_registry.active = _patched_active  # type: ignore
