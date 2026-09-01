from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field
from core.identifiers import new_id
from core.time import utcnow

class Prediction(BaseModel):
    id: str = Field(default_factory=lambda: new_id("pred"))
    event_id: str
    market: str
    selection: str
    model_probability: float = Field(ge=0, le=1)
    calibrated_probability: Optional[float] = Field(default=None, ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    model_version: str = "v0"
    feature_version: str = "v0"
    prompt_version: Optional[str] = None
    data_snapshot_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)
    rationale: Optional[str] = None
    evidence: list[str] = Field(default_factory=list)
    missing_data: list[str] = Field(default_factory=list)
    invalidation_conditions: list[str] = Field(default_factory=list)
    model_config = {"frozen": True}
