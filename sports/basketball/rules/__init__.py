"""Basketball rules — sport-specific validation, never in platform core."""
from __future__ import annotations

def validate_basketball_selection(market: str, selection: str) -> tuple[bool, str]:
    from sports.basketball.markets import BasketballMarket
    valid = {m.value for m in BasketballMarket}
    if market not in valid:
        return False, f"unknown basketball market {market}"
    if market == BasketballMarket.MONEYLINE.value and selection not in ("HOME","AWAY"):
        return False, "moneyline only HOME/AWAY (no draw in basketball)"
    return True, "ok"
