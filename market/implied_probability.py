def implied_probability(decimal_odds: float) -> float:
    if decimal_odds <= 1:
        return 0.0
    return 1.0 / decimal_odds

def remove_vig(implieds: list[float]) -> list[float]:
    total = sum(implieds)
    if total == 0:
        return implieds
    return [p/total for p in implieds]
