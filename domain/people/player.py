from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id

class Player(BaseModel):
    id: str = Field(default_factory=lambda: new_id("player"))
    name: str
    team_id: Optional[str] = None
    position: Optional[str] = None
    nationality: Optional[str] = None
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}
