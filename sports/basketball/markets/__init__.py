"""Basketball canonical markets — distinct from football BTTS/CORNERS."""
from __future__ import annotations
from enum import Enum

class BasketballMarket(str, Enum):
    MONEYLINE = "MONEYLINE"  # HOME/AWAY (no draw)
    SPREAD = "SPREAD"  # e.g. HOME -5.5 / AWAY +5.5
    TOTAL_POINTS = "TOTAL_POINTS"  # OVER_220_5 / UNDER_220_5
    TEAM_TOTAL = "TEAM_TOTAL"
    FIRST_HALF_MONEYLINE = "FIRST_HALF_MONEYLINE"
    QUARTER_WINNER = "QUARTER_WINNER"

# Mapping from provider raw → canonical basketball market
PROVIDER_MARKET_MAP = {
    "h2h": BasketballMarket.MONEYLINE,
    "spreads": BasketballMarket.SPREAD,
    "totals": BasketballMarket.TOTAL_POINTS,
    "team_totals": BasketballMarket.TEAM_TOTAL,
}
