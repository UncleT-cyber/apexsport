from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id
from datetime import datetime

class Result(BaseModel):
    id: str = Field(default_factory=lambda: new_id("res"))
    event_id: str
    home_score: int
    away_score: int
    outcome: str  # HOME/DRAW/AWAY
    decided_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    model_config = {"frozen": True}
