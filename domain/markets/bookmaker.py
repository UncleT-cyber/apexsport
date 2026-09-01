from __future__ import annotations
from pydantic import BaseModel, Field
from core.identifiers import new_id

class Bookmaker(BaseModel):
    id: str = Field(default_factory=lambda: new_id("book"))
    name: str
    code: str
    external_ids: dict[str, str] = Field(default_factory=dict)
    model_config = {"frozen": True}
