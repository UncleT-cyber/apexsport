"""Tennis rules — sport-specific validation."""
from __future__ import annotations

def validate_tennis_selection(market: str, selection: str) -> tuple[bool, str]:
    from sports.tennis.markets import TennisMarket
    valid = {m.value for m in TennisMarket}
    if market not in valid:
        return False, f"unknown tennis market {market}"
    if market == TennisMarket.MATCH_WINNER.value and selection not in ("HOME","AWAY"):
        return False, "match winner only HOME/AWAY (no draw in tennis)"
    return True, "ok"
