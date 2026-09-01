from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id

class Venue(BaseModel):
    id: str = Field(default_factory=lambda: new_id("venue"))
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    capacity: Optional[int] = None
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}
