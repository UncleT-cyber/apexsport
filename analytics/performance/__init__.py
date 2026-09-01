"""Performance analytics."""
def summary(predictions: list[dict], results: dict[str, str]) -> dict:
    from backtesting.engine import replay
    return replay(predictions, results)
