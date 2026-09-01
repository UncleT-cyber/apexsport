from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id
from datetime import datetime

class RiskAssessment(BaseModel):
    id: str = Field(default_factory=lambda: new_id("risk"))
    event_id: str
    level: str  # LOW/MEDIUM/HIGH/BLOCKED
    score: float = Field(ge=0, le=1)
    reasons: list[str] = Field(default_factory=list)
    data_quality: str = "ok"
    market_quality: str = "ok"
    model_disagreement: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    model_config = {"frozen": True}
