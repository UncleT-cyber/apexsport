from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field
from core.identifiers import new_id

class CanonicalMarket(str, Enum):
    MATCH_RESULT = "MATCH_RESULT"  # HOME/DRAW/AWAY
    TOTAL_GOALS = "TOTAL_GOALS"  # OVER/UNDER
    BTTS = "BTTS"
    DOUBLE_CHANCE = "DOUBLE_CHANCE"
    ASIAN_HANDICAP = "ASIAN_HANDICAP"
    CORNERS = "CORNERS"

class Market(BaseModel):
    id: str = Field(default_factory=lambda: new_id("mkt"))
    event_id: str
    canonical_market: CanonicalMarket
    provider_market_key: str  # raw provider mapping preserved for trace
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}
