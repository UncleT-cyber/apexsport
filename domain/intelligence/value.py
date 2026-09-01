from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

class ValueAssessment(BaseModel):
    event_id: str
    market: str
    selection: str
    market_odds: float
    implied_probability: float
    model_probability: float
    calibrated_probability: Optional[float] = None
    fair_odds: Optional[float] = None
    edge: float  # calibrated - implied or model - implied
    expected_value: float
    is_value: bool
    model_config = {"frozen": True}

def compute_value(market_odds: float, calibrated_prob: float) -> tuple[float, float, float, float]:
    """Canonical delegation — single source of truth is market/implied_probability + market/edge."""
    from market.implied_probability import implied_probability
    from market.edge import edge as calc_edge, expected_value, fair_odds
    implied = implied_probability(market_odds)
    edge = calc_edge(calibrated_prob, implied)
    ev = expected_value(calibrated_prob, market_odds)
    fair = fair_odds(calibrated_prob)
    return implied, edge, ev, fair
