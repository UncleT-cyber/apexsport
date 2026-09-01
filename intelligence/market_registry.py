"""Sport-aware Market Registry — canonical market contract is shared, valid markets/selections per sport.

CRITICAL: Do NOT force all sports into football's market semantics.

    Football: MATCH_RESULT (HOME/DRAW/AWAY), OVER_UNDER, BTTS, DOUBLE_CHANCE, etc.
    Basketball: MONEYLINE (HOME/AWAY — no DRAW), SPREAD, TOTAL_POINTS, etc.

The canonical MarketSnapshotEntry {market, selection, price_decimal} is shared.
Validation and valid market lists are sport-specific.

Tennis (extensibility): MATCH_WINNER (HOME/AWAY), SET_WINNER, GAME_SPREAD, TOTAL_GAMES, etc.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional


class FootballMarket(str, Enum):
    MATCH_RESULT = "MATCH_RESULT"  # HOME / DRAW / AWAY
    OVER_UNDER = "OVER_UNDER"  # OVER_2.5 / UNDER_2.5
    BTTS = "BTTS"  # YES / NO
    DOUBLE_CHANCE = "DOUBLE_CHANCE"  # HOME_DRAW / AWAY_DRAW / HOME_AWAY
    DRAW_NO_BET = "DRAW_NO_BET"  # HOME / AWAY (void if draw)
    CORRECT_SCORE = "CORRECT_SCORE"
    HT_FT = "HT_FT"


class BasketballMarket(str, Enum):
    MONEYLINE = "MONEYLINE"  # HOME / AWAY (no draw)
    SPREAD = "SPREAD"  # HOME_-5.5 / AWAY_+5.5
    TOTAL_POINTS = "TOTAL_POINTS"  # OVER_220.5 / UNDER_220.5
    TEAM_TOTAL = "TEAM_TOTAL"
    FIRST_HALF_MONEYLINE = "FIRST_HALF_MONEYLINE"
    QUARTER_WINNER = "QUARTER_WINNER"


# ─── Sport → valid markets ───────────────────────────────────────────────────
SPORT_MARKETS: dict[str, set[str]] = {
    "football": {m.value for m in FootballMarket},
    "basketball": {m.value for m in BasketballMarket},
    # Tennis template — NOT_IMPLEMENTED until tennis package registers
    # "tennis": {"MATCH_WINNER", "SET_WINNER", "GAME_SPREAD", "TOTAL_GAMES"},
}

# ─── Sport → market → valid selections ───────────────────────────────────────
SPORT_SELECTIONS: dict[str, dict[str, set[str]]] = {
    "football": {
        FootballMarket.MATCH_RESULT.value: {"HOME", "DRAW", "AWAY"},
        FootballMarket.OVER_UNDER.value: {"OVER_2.5", "UNDER_2.5", "OVER_1.5", "UNDER_1.5", "OVER_3.5", "UNDER_3.5"},
        FootballMarket.BTTS.value: {"YES", "NO"},
        FootballMarket.DOUBLE_CHANCE.value: {"HOME_DRAW", "AWAY_DRAW", "HOME_AWAY"},
        FootballMarket.DRAW_NO_BET.value: {"HOME", "AWAY"},
    },
    "basketball": {
        BasketballMarket.MONEYLINE.value: {"HOME", "AWAY"},  # NO DRAW
        BasketballMarket.SPREAD.value: set(),  # dynamic e.g. HOME_-5.5 — any valid if market matches
        BasketballMarket.TOTAL_POINTS.value: set(),  # dynamic OVER/UNDER
        BasketballMarket.TEAM_TOTAL.value: set(),
    },
}

# Canonical primary market per sport (used by value engine / prediction default)
PRIMARY_MARKET: dict[str, str] = {
    "football": FootballMarket.MATCH_RESULT.value,
    "basketball": BasketballMarket.MONEYLINE.value,
    # tennis would be MATCH_WINNER
}

# Expected probability keys per sport (what AgentOutput.probabilities must contain)
PROBABILITY_KEYS: dict[str, set[str]] = {
    "football": {"HOME", "DRAW", "AWAY"},
    "basketball": {"HOME", "AWAY"},
}


def get_valid_markets(sport: str) -> set[str]:
    return set(SPORT_MARKETS.get(sport, set()))


def get_primary_market(sport: str) -> str:
    return PRIMARY_MARKET.get(sport, "MATCH_RESULT" if sport == "football" else "MONEYLINE")


def get_probability_keys(sport: str) -> set[str]:
    return PROBABILITY_KEYS.get(sport, {"HOME", "DRAW", "AWAY"} if sport == "football" else {"HOME", "AWAY"})


def validate_market(sport: str, market: str, selection: str) -> tuple[bool, str]:
    """Validate sport+market+selection. Returns (ok, reason).

    If sport is unknown → NOT_IMPLEMENTED (do not guess).
    """
    if sport not in SPORT_MARKETS:
        return False, f"NOT_IMPLEMENTED: sport '{sport}' has no market registry"

    valid_markets = SPORT_MARKETS[sport]
    if market not in valid_markets:
        return False, f"invalid market '{market}' for {sport} — valid: {sorted(valid_markets)}"

    # If market has explicit valid selections, enforce them
    selections_map = SPORT_SELECTIONS.get(sport, {})
    if market in selections_map:
        valid_sels = selections_map[market]
        # Empty set → dynamic (SPREAD, TOTAL) → allow any selection string
        if valid_sels and selection not in valid_sels:
            return False, f"invalid selection '{selection}' for {sport} {market} — valid: {sorted(valid_sels)}"

    # Basketball MONEYLINE must never have DRAW
    if sport == "basketball" and market == BasketballMarket.MONEYLINE.value and selection == "DRAW":
        return False, "basketball MONEYLINE has no DRAW (only HOME/AWAY)"

    # Football MATCH_RESULT must allow DRAW
    return True, "ok"


def validate_probabilities(sport: str, probabilities: dict[str, float]) -> tuple[bool, str]:
    """Validate that probabilities match sport's required keys."""
    if sport not in PROBABILITY_KEYS:
        return False, f"NOT_IMPLEMENTED: sport '{sport}' has no probability contract"
    required = PROBABILITY_KEYS[sport]
    keys = set(probabilities.keys())
    if sport == "basketball":
        if "DRAW" in keys:
            return False, "basketball probabilities must not include DRAW"
        if not {"HOME", "AWAY"}.issubset(keys):
            return False, f"basketball probabilities must include HOME and AWAY, got {keys}"
    elif sport == "football":
        if not required.issubset(keys):
            return False, f"football probabilities must include {required}, got {keys}"
    return True, "ok"


def is_implemented(sport: str) -> bool:
    return sport in SPORT_MARKETS


def register_sport_markets(
    sport: str,
    markets: set[str],
    selections: Optional[dict[str, set[str]]] = None,
    primary: Optional[str] = None,
    prob_keys: Optional[set[str]] = None,
) -> None:
    """Extensibility hook for new sports (e.g. tennis).

    Usage:
        from intelligence.market_registry import register_sport_markets
        register_sport_markets(
            "tennis",
            {"MATCH_WINNER", "SET_WINNER", "GAME_SPREAD", "TOTAL_GAMES"},
            {"MATCH_WINNER": {"HOME", "AWAY"}, "SET_WINNER": {"HOME", "AWAY"}},
            primary="MATCH_WINNER",
            prob_keys={"HOME", "AWAY"},
        )
    """
    SPORT_MARKETS[sport] = set(markets)
    if selections is not None:
        SPORT_SELECTIONS[sport] = {k: set(v) for k, v in selections.items()}
    if primary:
        PRIMARY_MARKET[sport] = primary
    if prob_keys:
        PROBABILITY_KEYS[sport] = set(prob_keys)
