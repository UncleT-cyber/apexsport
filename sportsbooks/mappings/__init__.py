"""Per-sportsbook market mappings — sportbook-specific formatting only at edge.

Apex canonical → sportsbook expected keys.
"""
from __future__ import annotations

# DraftKings / FanDuel style (The Odds API) uses h2h/spreads/totals for basketball
SPORTSBOOK_MARKET_KEYS = {
    "draftkings": {
        "MONEYLINE": "h2h",
        "SPREAD": "spreads",
        "TOTAL_POINTS": "totals",
        "MATCH_RESULT": "h2h",  # football 1x2 mapped to h2h for US books
        "TEAM_TOTAL": "team_totals",
    },
    "fanduel": {
        "MONEYLINE": "h2h",
        "SPREAD": "spreads",
        "TOTAL_POINTS": "totals",
    },
    "sportybet": {
        "MATCH_RESULT": "1x2",
        "TOTAL_GOALS": "over_under",
        "BTTS": "btts",
        "MONEYLINE": "1x2",  # sportybet basketball moneyline as 1x2 without draw
        "SPREAD": "handicap",
        "TOTAL_POINTS": "total_points",
    },
    "bet9ja": {
        "MATCH_RESULT": "1X2",
        "TOTAL_GOALS": "OVER / UNDER 2.5",
        "MONEYLINE": "Match Winner",
        "SPREAD": "Handicap",
        "TOTAL_POINTS": "Total Points",
    },
    "betway": {
        "MATCH_RESULT": "1x2",
        "TOTAL_GOALS": "total_goals",
        "MONEYLINE": "moneyline",
        "SPREAD": "point_spread",
        "TOTAL_POINTS": "totals",
    },
}

def to_sportsbook_market(canonical: str, sportsbook: str) -> str:
    book = sportsbook.lower()
    mapping = SPORTSBOOK_MARKET_KEYS.get(book, {})
    return mapping.get(canonical, canonical)

def from_sportsbook_market(book_key: str, sportsbook: str) -> str:
    book = sportsbook.lower()
    mapping = SPORTSBOOK_MARKET_KEYS.get(book, {})
    # reverse lookup
    for canon, bkey in mapping.items():
        if bkey.lower() == book_key.lower():
            return canon
    return book_key.upper()
