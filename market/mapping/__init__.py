"""Provider raw market → canonical mapping (sport-aware). Preserves trace."""
from __future__ import annotations
from market.canonical import CanonicalMarket
from sports.basketball.markets import PROVIDER_MARKET_MAP as BB_MAP

# Football provider maps
FOOTBALL_MAP = {
    "1x2": CanonicalMarket.MATCH_RESULT,
    "match_result": CanonicalMarket.MATCH_RESULT,
    "h2h_football": CanonicalMarket.MATCH_RESULT,
    "over_under": CanonicalMarket.TOTAL_GOALS,
    "totals_goals": CanonicalMarket.TOTAL_GOALS,
    "btts": CanonicalMarket.BTTS,
    "both_teams_to_score": CanonicalMarket.BTTS,
    "double_chance": CanonicalMarket.DOUBLE_CHANCE,
    "asian_handicap": CanonicalMarket.ASIAN_HANDICAP,
    "corners": CanonicalMarket.CORNERS,
}

BASKETBALL_MAP = {
    "h2h": BB_MAP["h2h"],
    "spreads": BB_MAP["spreads"],
    "totals": BB_MAP["totals"],
    "team_totals": BB_MAP["team_totals"],
    "moneyline": BB_MAP["h2h"],
}

COMBINED = {**FOOTBALL_MAP, **BASKETBALL_MAP}

def to_canonical(raw_key: str, sport: str = "football") -> tuple[CanonicalMarket | None, str]:
    """Return (canonical, provider_key_trace)."""
    key = raw_key.lower().strip()
    # sport-aware lookup
    if sport == "basketball":
        if key in BASKETBALL_MAP:
            return BASKETBALL_MAP[key], raw_key
    else:
        if key in FOOTBALL_MAP:
            return FOOTBALL_MAP[key], raw_key
    # fallback combined
    if key in COMBINED:
        return COMBINED[key], raw_key
    return None, raw_key
