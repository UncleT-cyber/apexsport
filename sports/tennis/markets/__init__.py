"""Tennis canonical markets — distinct from football/basketball."""
from __future__ import annotations
from enum import Enum

class TennisMarket(str, Enum):
    MATCH_WINNER = "MATCH_WINNER"  # HOME/AWAY (no draw)
    SET_WINNER = "SET_WINNER"
    GAME_SPREAD = "GAME_SPREAD"
    TOTAL_GAMES = "TOTAL_GAMES"
    SET_BETTING = "SET_BETTING"  # 2-0, 2-1 etc.

PROVIDER_MARKET_MAP = {
    "h2h": TennisMarket.MATCH_WINNER,
    "set_winner": TennisMarket.SET_WINNER,
    "game_spread": TennisMarket.GAME_SPREAD,
}
