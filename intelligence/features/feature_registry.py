"""Feature registry — sport-aware, modular, extensible.

CRITICAL: Feature definitions and calculators MUST be sport-aware.
Do NOT send football-specific features into a basketball specialist or vice versa.

Architecture:
    Sport → Specialist → Sport-specific Prompt → Sport-specific Feature Context → AgentOutput

    Shared: specialist interface, AgentInput/Output contracts, prompt versioning, model registry,
            ensemble, calibration, value, risk, prediction contract, provenance.
    Sport-specific: feature definitions, calculators, evidence, terminology, markets.

Example feature sets:
    Football: xG, xGA, goals, clean_sheets, home_away_form, elo, injuries, H2H
    Basketball: pace, offensive_rating, defensive_rating, points_per_possession, rest_days, rotation

Usage:
    feature_registry.register("football", "form", calculator_fn)
    feature_registry.register("basketball", "pace", calculator_fn)
    feature_registry.get_for_sport("football", "form")
    feature_registry.compute_for_sport("football", ["form", "team_strength"], ctx)

Legacy .register(name, fn) → registers for BOTH sports (migration shim).
All new code must use sport-scoped registration.
"""
from __future__ import annotations

from typing import Callable, Optional


class SportFeatureRegistry:
    def __init__(self) -> None:
        # (sport, name) → fn
        self._features: dict[tuple[str, str], Callable] = {}
        # Legacy flat: name → fn (applies to any sport if sport-specific missing)
        self._legacy: dict[str, Callable] = {}

    # ─── Registration ────────────────────────────────────────────────────────
    def register(self, *args, **kwargs):
        """Dual signature:
            register(sport, name, fn)
            register(name, fn)  → legacy (registers for all sports via legacy dict)
            register(name, fn, sport="football") → explicit sport kwarg
        """
        if len(args) == 3:
            sport, name, fn = args  # type: ignore
            self._features[(sport, name)] = fn
            return
        if len(args) == 2:
            name, fn = args  # type: ignore
            # Legacy flat registration — store in legacy
            self._legacy[name] = fn
            return
        # kwargs dispatch
        if "sport" in kwargs:
            sport = kwargs.pop("sport")
            name = kwargs.pop("name", None) or kwargs.pop("feature", None)
            fn = kwargs.pop("fn", None) or kwargs.pop("calculator", None) or next(iter(kwargs.values()), None)
            if sport and name and fn:
                self._features[(sport, name)] = fn
                return
        raise ValueError(f"Invalid register args: {args} {kwargs}")

    def register_for_sport(self, sport: str, name: str, fn: Callable) -> None:
        self._features[(sport, name)] = fn

    # ─── Resolution ──────────────────────────────────────────────────────────
    def get_for_sport(self, sport: str, name: str) -> Optional[Callable]:
        """Strict sport-scoped lookup. No cross-sport fallback."""
        # Exact sport match first
        fn = self._features.get((sport, name))
        if fn:
            return fn
        # Fallback to legacy only if no sport-specific exists AND legacy is explicitly allowed
        # But per spec: do NOT send football features to basketball. So we return None if no sport-specific.
        # Legacy calculators that are sport-agnostic (match_context, market_context) are replicated per sport.
        # Hence, we do NOT fallback to legacy for missing sport-specific calculators.
        return None

    def get_legacy(self, name: str) -> Optional[Callable]:
        return self._legacy.get(name)

    def get(self, name: str, sport: Optional[str] = None) -> Optional[Callable]:
        """If sport given, strict lookup. Otherwise legacy."""
        if sport:
            return self.get_for_sport(sport, name)
        return self._legacy.get(name)

    def all(self) -> dict[str, Callable]:
        """Legacy all — returns flat legacy dict."""
        return dict(self._legacy)

    def all_for_sport(self, sport: str) -> dict[str, Callable]:
        """All calculators for a sport: sport-specific + legacy if no sport-specific override."""
        out: dict[str, Callable] = {}
        # Add legacy as base (for match_context etc. that are shared logic but registered legacy)
        out.update(self._legacy)
        # Overlay sport-specific
        for (s, name), fn in self._features.items():
            if s == sport:
                out[name] = fn
        return out

    def all_sport_computed(self) -> dict[tuple[str, str], Callable]:
        return dict(self._features)

    def available_features_for_sport(self, sport: str) -> list[str]:
        keys = set(self._legacy.keys())
        for (s, name) in self._features:
            if s == sport:
                keys.add(name)
        return sorted(keys)

    def compute(self, names: list[str], ctx: dict, sport: Optional[str] = None) -> dict:
        """Compute features for given names. If sport given, use sport-scoped resolution."""
        out: dict = {}
        for n in names:
            fn: Optional[Callable] = None
            if sport:
                fn = self.get_for_sport(sport, n) or self._legacy.get(n)
            else:
                fn = self._legacy.get(n) or next((v for (s, k), v in self._features.items() if k == n), None)
            if fn:
                try:
                    out[n] = fn(ctx)
                except Exception as e:
                    out[n] = {"error": str(e), "_status": "uncertain"}
            else:
                out[n] = {"_status": "unavailable", "_reason": f"no calculator {n} for sport={sport or 'unknown'}"}
        return out

    def compute_for_sport(self, sport: str, names: list[str], ctx: dict) -> dict:
        return self.compute(names, ctx, sport=sport)

    def __len__(self) -> int:
        return len(self._features) + len(self._legacy)


feature_registry = SportFeatureRegistry()

# ─── Real calculators ─────────────────────────────────────────────────────────
# MATCH_CONTEXT: always available from fixture (canonical) — sport-agnostic logic, but registered per sport
def match_context(ctx: dict) -> dict:
    fixture = ctx.get("fixture") or {}
    if hasattr(fixture, "model_dump"):
        fixture = fixture.model_dump()
    return {
        "competition": fixture.get("competition") or fixture.get("competition_code") or "Unknown",
        "venue": fixture.get("venue") or "Unknown",
        "kickoff_at": fixture.get("kickoff_at") or fixture.get("kickoff") or "",
        "sport": fixture.get("sport") or ctx.get("sport") or "football",
        "status": fixture.get("status") or "scheduled",
        "_status": "available",
    }


# MARKET_CONTEXT: available only if MarketSnapshot has entries — sport-agnostic but needs sport for semantics
def market_context(ctx: dict) -> dict:
    ms = ctx.get("market_snapshot")
    if not ms:
        return {"_status": "unavailable", "_reason": "no market snapshot"}
    if hasattr(ms, "model_dump"):
        ms = ms.model_dump()
    entries = ms.get("entries", []) if isinstance(ms, dict) else []
    if not entries:
        try:
            entries = ms.entries if hasattr(ms, "entries") else []
        except Exception:
            entries = []
    if not entries:
        return {"_status": "unavailable", "_reason": "no odds entries in MarketSnapshot"}
    try:
        implieds = [1 / e["price_decimal"] for e in entries if e.get("price_decimal", 0) > 1]
        vig = sum(implieds) - 1 if implieds else 0
        return {
            "odds_count": len(entries),
            "vig": round(vig, 3),
            "markets": list({e.get("market") for e in entries}),
            "best_odds": max(e.get("price_decimal", 0) for e in entries),
            "_status": "available",
        }
    except Exception as e:
        return {"_status": "uncertain", "_reason": str(e)}


def _unavailable(reason: str):
    def fn(ctx: dict) -> dict:
        return {"_status": "unavailable", "_reason": reason}

    return fn


# ─── Register shared calculators per sport (explicit, no cross-sport leakage) ──
# Match/market context are semantically same computation but registered per sport to satisfy NOT_IMPLEMENTED semantics
for sport in ("football", "basketball"):
    feature_registry.register(sport, "match_context", match_context)
    feature_registry.register(sport, "market_context", market_context)

# Legacy flat (for backward compat — will be phased out)
feature_registry.register("match_context", match_context)
feature_registry.register("market_context", market_context)

# ─── Football feature groups (xG-centric) ────────────────────────────────────
feature_registry.register("football", "form", _unavailable("no historical form feed — last 5 results unavailable"))
feature_registry.register("football", "team_strength", _unavailable("no Elo/xG feed — team strength unavailable"))
feature_registry.register("football", "availability", _unavailable("no injury/lineup feed — availability unavailable"))
feature_registry.register("football", "matchup", _unavailable("no H2H/formation feed — matchup unavailable"))
feature_registry.register("football", "xg", _unavailable("no xG feed — xG unavailable"))
feature_registry.register("football", "btts_rate", _unavailable("no historical BTTS feed"))

# Legacy flat for football features (so old code without sport still finds them)
feature_registry.register("form", _unavailable("no historical form feed — last 5 results unavailable"))
feature_registry.register("team_strength", _unavailable("no Elo/xG feed — team strength unavailable"))
feature_registry.register("availability", _unavailable("no injury/lineup feed — availability unavailable"))
feature_registry.register("matchup", _unavailable("no H2H/formation feed — matchup unavailable"))
feature_registry.register("xg", _unavailable("no xG feed — xG unavailable"))
feature_registry.register("btts_rate", _unavailable("no historical BTTS feed"))

# ─── Basketball feature groups (pace-centric) ─────────────────────────────────
def _bb_unavailable(name: str):
    return _unavailable(f"no basketball {name} feed")


# Note: basketball's FORM/TEAM_STRENGTH/AVAILABILITY/MATCHUP groups are basketball-specific
# but we keep generic group names for pipeline parity. Their calculators delegate to bb_* impl.
def bb_form_calculator(ctx: dict) -> dict:
    # Combines pace + offensive rating deltas as basketball "form"
    # Returns unavailable until real feed; never fabricate
    return {"_status": "unavailable", "_reason": "no basketball form feed — pace/offense unavailable"}


def bb_team_strength_calculator(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball Elo feed — use bb_offensive_rating/drtg"}


def bb_availability_calculator(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball injury/load feed"}


def bb_matchup_calculator(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball H2H/scheme feed"}


# Register basketball pipeline groups (sport-specific intelligence, shared interface)
feature_registry.register("basketball", "form", bb_form_calculator)
feature_registry.register("basketball", "team_strength", bb_team_strength_calculator)
feature_registry.register("basketball", "availability", bb_availability_calculator)
feature_registry.register("basketball", "matchup", bb_matchup_calculator)

# Basketball raw metrics (for specialists that need pace/detail)
for k in ["bb_pace", "bb_offensive_rating", "bb_defensive_rating", "bb_rebound_rate", "bb_back_to_back", "bb_three_point_variance"]:
    feature_registry.register("basketball", k, _bb_unavailable(k))
    # Legacy also
    feature_registry.register(k, _bb_unavailable(k))
