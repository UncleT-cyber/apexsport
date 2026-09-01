from __future__ import annotations
from typing import Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from core.identifiers import new_id

class AnalysisOutput(BaseModel):
    id: str = Field(default_factory=lambda: new_id("analysis"))
    agent: str
    agent_version: str = "v1"
    prompt_version: Optional[str] = None
    event_id: str
    summary: str
    confidence: float = Field(ge=0, le=1)
    evidence: list[str] = Field(default_factory=list)
    confluences: list[str] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    uncertainty: list[str] = Field(default_factory=list)
    data_quality: str = "ok"  # ok/degraded/poor
    missing_data: list[str] = Field(default_factory=list)
    invalidation_conditions: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    model_config = {"frozen": True}
