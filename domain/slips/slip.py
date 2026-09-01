from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from core.identifiers import new_id

class SlipSelection(BaseModel):
    event_id: str
    event_label: str  # "ARS vs CHE"
    market: str
    selection: str
    odds: float
    probability: Optional[float] = None
    calibrated_probability: Optional[float] = None
    edge: Optional[float] = None
    confidence: Optional[float] = None
    rationale: Optional[str] = None
    # Provenance — traceable to Prediction
    prediction_id: Optional[str] = None
    sport: Optional[str] = None
    competition: Optional[str] = None
    kickoff_at: Optional[str] = None
    model_used: Optional[str] = None
    model_config = {"frozen": True}

class BetSlip(BaseModel):
    """Canonical Slip — persistence identity is id; total_odds is derived.

    Like ApexLoop Signal, total_odds should be derived via compute_total_odds()
    and not manually set to an inconsistent value. Prefer with_total_odds().
    Booking_code is external reference only (never invented by Apex).
    """
    id: str = Field(default_factory=lambda: new_id("slip"))
    selections: list[SlipSelection] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    risk_level: Optional[str] = None
    total_odds: Optional[float] = None
    booking_code: Optional[str] = None  # external reference, never invented
    sportsbook: Optional[str] = None
    status: str = "draft"  # draft/validated/exported
    model_config = {"frozen": False}

    def compute_total_odds(self) -> float:
        total = 1.0
        for s in self.selections:
            total *= s.odds
        return round(total, 2)

    def with_total_odds(self) -> "BetSlip":
        """Return a new BetSlip with computed total_odds (deterministic)."""
        return self.model_copy(update={"total_odds": self.compute_total_odds()})
