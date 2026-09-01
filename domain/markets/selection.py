from __future__ import annotations
from pydantic import BaseModel, Field
from core.identifiers import new_id

class Selection(BaseModel):
    id: str = Field(default_factory=lambda: new_id("sel"))
    market_id: str
    label: str  # HOME, DRAW, AWAY, OVER_2_5 etc.
    model_config = {"frozen": True}
