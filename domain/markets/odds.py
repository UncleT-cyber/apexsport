from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id
from core.time import utcnow

class OddsSnapshot(BaseModel):
    id: str = Field(default_factory=lambda: new_id("odds"))
    event_id: str
    market: str
    selection: str
    bookmaker: str
    price_decimal: float
    implied_probability: Optional[float] = None
    captured_at: datetime = Field(default_factory=utcnow)
    is_stale: bool = False
    model_config = {"frozen": True}

    def compute_implied(self) -> float:
        if self.price_decimal <= 1:
            return 0.0
        return 1.0 / self.price_decimal
