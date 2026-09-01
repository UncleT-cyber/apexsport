"""FeatureSnapshot builder — sport-aware, with DataStatus.

CRITICAL: Prompts must consume the feature snapshot appropriate to the sport.
Do not send football-specific features into a basketball specialist or vice versa.

    Football may contain: xG, xGA, goals, clean_sheets, home_away_form
    Basketball may contain: pace, offensive_rating, defensive_rating, points_per_possession, rest_days, rotation

The Feature Registry is sport-aware. Each sport's calculators are isolated.

Pipeline: MarketSnapshot → FeatureSnapshot (sport-specific) → Specialist (sport-specific prompt + features) → Ensemble → ...

Shared: specialist interface, snapshot contract, group names.
Sport-specific: calculators behind each group, evidence values.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from intelligence.contracts import FeatureSnapshot, FeatureGroup, DataStatus, FEATURE_VERSION
from intelligence.features.feature_registry import feature_registry

# Unified 6 groups for all sports (interface contract — shared)
GROUPS = ["MATCH_CONTEXT", "FORM", "TEAM_STRENGTH", "AVAILABILITY", "MATCHUP", "MARKET_CONTEXT"]

# One calculator per group — registry keys match lowercased group names
GROUP_TO_CALCULATOR = {
    "MATCH_CONTEXT": "match_context",
    "FORM": "form",
    "TEAM_STRENGTH": "team_strength",
    "AVAILABILITY": "availability",
    "MATCHUP": "matchup",
    "MARKET_CONTEXT": "market_context",
}

# Sport-specific validation: which calculators are valid for which sport
# Used to emit NOT_IMPLEMENTED if a sport lacks a calculator (never stall with generic)
# Extensibility: adding tennis requires adding an entry here and registering calculators
SPORT_GROUP_VALIDATION: dict[str, set[str]] = {
    "football": {"match_context", "form", "team_strength", "availability", "matchup", "market_context", "xg", "btts_rate"},
    "basketball": {
        "match_context",
        "form",
        "team_strength",
        "availability",
        "matchup",
        "market_context",
        "bb_pace",
        "bb_offensive_rating",
        "bb_defensive_rating",
        "bb_rebound_rate",
        "bb_back_to_back",
        "bb_three_point_variance",
    },
    "tennis": {
        "match_context",
        "form",
        "team_strength",
        "availability",
        "matchup",
        "market_context",
        "serve",
        "baseline",
        "break_point",
    },
}


def build_feature_snapshot(
    fixture_id: str,
    sport: str,
    fixture: dict | None = None,
    market_snapshot: Any | None = None,
) -> FeatureSnapshot:
    now = datetime.now(timezone.utc)
    groups: list[FeatureGroup] = []

    for group_name in GROUPS:
        calc_key = GROUP_TO_CALCULATOR.get(group_name)
        if not calc_key:
            groups.append(
                FeatureGroup(
                    name=group_name,
                    status=DataStatus.UNAVAILABLE,
                    values={},
                    unavailable_reason=f"no calculator mapping for {group_name}",
                    computed_at=now,
                    staleness_seconds=0,
                )
            )
            continue

        # Sport-aware resolution — no cross-sport fallback
        # First try sport-specific, then legacy flat for shared calculators (match_context, market_context)
        fn = feature_registry.get_for_sport(sport, calc_key)
        if fn is None:
            # Shared calculators (match_context, market_context) are replicated per sport but also in legacy
            # For other groups, missing sport-specific → NOT_IMPLEMENTED, not football fallback
            legacy_fn = feature_registry.get_legacy(calc_key)
            # Only allow legacy fallback for sport-agnostic groups (MATCH_CONTEXT, MARKET_CONTEXT)
            if group_name in ("MATCH_CONTEXT", "MARKET_CONTEXT") and legacy_fn:
                fn = legacy_fn
            else:
                # No calculator for this sport/group → mark UNAVAILABLE with NOT_IMPLEMENTED reason
                # Do NOT silently use football's calculator for basketball
                if sport not in SPORT_GROUP_VALIDATION or calc_key not in SPORT_GROUP_VALIDATION.get(sport, set()):
                    reason = f"NOT_IMPLEMENTED: no {calc_key} calculator for sport={sport}"
                else:
                    reason = f"no calculator {calc_key} for sport={sport}"
                groups.append(
                    FeatureGroup(
                        name=group_name,
                        status=DataStatus.UNAVAILABLE,
                        values={},
                        unavailable_reason=reason,
                        computed_at=now,
                        staleness_seconds=0,
                    )
                )
                continue

        try:
            ctx = {"fixture": fixture or {}, "sport": sport, "market_snapshot": market_snapshot}
            # Use sport-aware compute
            result = feature_registry.compute_for_sport(sport, [calc_key], ctx).get(calc_key, {})
            if isinstance(result, dict) and "_status" in result:
                status_str = result.pop("_status")
                reason = result.pop("_reason", None) if isinstance(result, dict) else None
                try:
                    status = DataStatus(status_str)
                except Exception:
                    status = DataStatus.UNCERTAIN if status_str == "uncertain" else DataStatus.UNAVAILABLE
                if any(isinstance(v, dict) and "error" in str(v).lower() for v in [result]):
                    status = DataStatus.UNCERTAIN
                groups.append(
                    FeatureGroup(
                        name=group_name,
                        status=status,
                        values=result if status == DataStatus.AVAILABLE else {},
                        unavailable_reason=reason,
                        computed_at=now,
                        staleness_seconds=0,
                    )
                )
            else:
                if isinstance(result, dict) and result and not result.get("error"):
                    groups.append(FeatureGroup(name=group_name, status=DataStatus.AVAILABLE, values=result, computed_at=now, staleness_seconds=0))
                else:
                    reason = result.get("error") if isinstance(result, dict) else "empty"
                    groups.append(
                        FeatureGroup(
                            name=group_name,
                            status=DataStatus.UNAVAILABLE,
                            values={},
                            unavailable_reason=str(reason)[:120],
                            computed_at=now,
                            staleness_seconds=0,
                        )
                    )
        except Exception as e:
            groups.append(
                FeatureGroup(
                    name=group_name,
                    status=DataStatus.UNAVAILABLE,
                    values={},
                    unavailable_reason=str(e)[:120],
                    computed_at=now,
                    staleness_seconds=0,
                )
            )

    return FeatureSnapshot(
        fixture_id=fixture_id,
        sport=sport,
        feature_version=FEATURE_VERSION,
        groups=groups,
        created_at=now,
    )


def validate_snapshot_for_sport(snapshot: FeatureSnapshot, sport: str) -> tuple[bool, str]:
    """Ensure snapshot sport matches requested sport — prevents cross-sport feature leakage."""
    if snapshot.sport != sport:
        return False, f"FeatureSnapshot sport mismatch: snapshot={snapshot.sport} requested={sport} — refusing to send {snapshot.sport} features to {sport} specialist"
    return True, "ok"
