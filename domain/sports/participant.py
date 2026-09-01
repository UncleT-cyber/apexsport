from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id

class Participant(BaseModel):
    """Canonical team/participant."""
    id: str = Field(default_factory=lambda: new_id("team"))
    sport_code: str = "football"
    name: str
    short_name: str
    code: str  # canonical code e.g. ARS
    country: Optional[str] = None
    logo_url: Optional[str] = None
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}
