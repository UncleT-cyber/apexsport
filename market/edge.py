def edge(calibrated_prob: float, implied_prob: float) -> float:
    return calibrated_prob - implied_prob

def expected_value(calibrated_prob: float, decimal_odds: float) -> float:
    return calibrated_prob * decimal_odds - 1

def fair_odds(calibrated_prob: float) -> float:
    return 1.0 / calibrated_prob if calibrated_prob > 0 else 0.0
