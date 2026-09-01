"""Basketball sport domain — extends canonical domain, does NOT pollute platform core.

Canonical: SPORT/COMPETITION/EVENT/PARTICIPANT/TEAM/PLAYER/MARKET/ODDS/STATISTICS
Basketball-specific lives here.
"""
from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field

class BasketballPosition(str, Enum):
    PG = "PG"
    SG = "SG"
    SF = "SF"
    PF = "PF"
    C = "C"

class BasketballStatLine(BaseModel):
    """Canonical per-team/per-game stat — basketball specific, stays in basketball domain."""
    points: int = 0
    rebounds: int = 0
    assists: int = 0
    steals: int = 0
    blocks: int = 0
    turnovers: int = 0
    fg_pct: float = Field(ge=0, le=1, default=0)
    three_pct: float = Field(ge=0, le=1, default=0)
    ft_pct: float = Field(ge=0, le=1, default=0)
    possessions: int = 0
    pace: float = 0  # possessions per 48
    offensive_rating: float = 0  # points per 100 possessions
    defensive_rating: float = 0
    model_config = {"frozen": True}

class BasketballFixtureContext(BaseModel):
    """Enriched context for a basketball event — consumed by basketball features/agents."""
    event_id: str
    home_team_id: str
    away_team_id: str
    home_statline: BasketballStatLine | None = None
    away_statline: BasketballStatLine | None = None
    is_back_to_back_home: bool = False
    is_back_to_back_away: bool = False
    injuries_home: list[str] = Field(default_factory=list)
    injuries_away: list[str] = Field(default_factory=list)
    model_config = {"frozen": True}
