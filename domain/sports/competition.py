from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

from core.identifiers import new_id

class Competition(BaseModel):
    id: str = Field(default_factory=lambda: new_id("comp"))
    sport_code: str = "football"
    name: str
    code: str  # e.g. EPL
    country: Optional[str] = None
    tier: Optional[int] = None
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}
