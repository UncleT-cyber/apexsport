from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id

class Season(BaseModel):
    id: str = Field(default_factory=lambda: new_id("season"))
    competition_id: str
    name: str  # e.g. 2025/26
    year: int
    is_current: bool = True
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}
