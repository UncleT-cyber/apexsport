"""Value engine — deterministic, auditable. Never LLM."""
from dataclasses import dataclass
from market.implied_probability import implied_probability
from market.edge import edge, expected_value, fair_odds

@dataclass(frozen=True)
class ValueAssessment:
    market_odds: float
    implied_probability: float
    calibrated_probability: float
    fair_odds_val: float
    edge: float
    expected_value: float
    is_value: bool

def assess_value(market_odds: float, calibrated_prob: float, min_edge: float = 0.03) -> ValueAssessment:
    implied = implied_probability(market_odds)
    e = edge(calibrated_prob, implied)
    ev = expected_value(calibrated_prob, market_odds)
    fair = fair_odds(calibrated_prob)
    return ValueAssessment(
        market_odds=market_odds,
        implied_probability=implied,
        calibrated_probability=calibrated_prob,
        fair_odds_val=fair,
        edge=e,
        expected_value=ev,
        is_value=e >= min_edge and ev > 0,
    )
