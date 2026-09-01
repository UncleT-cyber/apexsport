"""Canonical markets — sport-agnostic registry.

Football: MATCH_RESULT/BTTS/CORNERS, Basketball: MONEYLINE/SPREAD/TOTAL_POINTS etc.
Provider keys map → canonical via market/mapping.
"""
from __future__ import annotations
from enum import Enum

class CanonicalMarket(str, Enum):
    # Football
    MATCH_RESULT = "MATCH_RESULT"  # HOME/DRAW/AWAY
    TOTAL_GOALS = "TOTAL_GOALS"  # OVER_2_5 etc
    BTTS = "BTTS"
    DOUBLE_CHANCE = "DOUBLE_CHANCE"
    ASIAN_HANDICAP = "ASIAN_HANDICAP"
    CORNERS = "CORNERS"
    # Basketball
    MONEYLINE = "MONEYLINE"  # HOME/AWAY (no draw)
    SPREAD = "SPREAD"
    TOTAL_POINTS = "TOTAL_POINTS"
    TEAM_TOTAL = "TEAM_TOTAL"
    FIRST_HALF_MONEYLINE = "FIRST_HALF_MONEYLINE"
    QUARTER_WINNER = "QUARTER_WINNER"
    # Shared
    OVER_UNDER = "OVER_UNDER"

# Sport → allowed canonical markets (prevents football BTTS on basketball)
SPORT_MARKETS: dict[str, list[CanonicalMarket]] = {
    "football": [CanonicalMarket.MATCH_RESULT, CanonicalMarket.TOTAL_GOALS, CanonicalMarket.BTTS, CanonicalMarket.DOUBLE_CHANCE, CanonicalMarket.ASIAN_HANDICAP, CanonicalMarket.CORNERS],
    "basketball": [CanonicalMarket.MONEYLINE, CanonicalMarket.SPREAD, CanonicalMarket.TOTAL_POINTS, CanonicalMarket.TEAM_TOTAL, CanonicalMarket.FIRST_HALF_MONEYLINE, CanonicalMarket.QUARTER_WINNER],
}

def is_valid_for_sport(market: str, sport: str) -> bool:
    allowed = SPORT_MARKETS.get(sport, [])
    return any(m.value == market for m in allowed)
