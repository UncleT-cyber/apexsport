from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id

class EventStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    HALFTIME = "halftime"
    COMPLETED = "completed"
    POSTPONED = "postponed"
    CANCELLED = "cancelled"

class Event(BaseModel):
    id: str = Field(default_factory=lambda: new_id("evt"))
    sport_code: str = "football"
    competition_id: str
    season_id: Optional[str] = None
    home_participant_id: str
    away_participant_id: str
    venue_id: Optional[str] = None
    kickoff_at: datetime
    status: EventStatus = EventStatus.SCHEDULED
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    external_ids: dict[str, str] = Field(default_factory=dict)
    data_freshness_ts: Optional[datetime] = None
    model_config = {"frozen": False}

class FixtureDTO(BaseModel):
    """Canonical DTO exposed to frontend — provider-agnostic."""
    id: str
    sport_code: str
    competition: str
    competition_code: str
    home_team: str
    away_team: str
    home_code: str
    away_code: str
    kickoff_at: datetime
    status: EventStatus
    venue: Optional[str] = None
