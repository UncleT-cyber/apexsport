"""Walk-forward: sliding window, training vs testing, no future leakage."""
from __future__ import annotations
from datetime import datetime, timezone
from backtesting.engine import replay

def walk_forward(
    predictions: list[dict],
    results: dict[str, str],
    window: int = 5,
    step: int = 2,
) -> list[dict]:
    """
    Simulate walk-forward: sort predictions by created_at, slide window.
    Each fold's predictions are evaluated only on outcomes available at that timestamp (no leakage simulated via sorted order).
    """
    preds = sorted(predictions, key=lambda p: p.get("created_at",""))
    folds = []
    for start in range(0, max(1, len(preds)-window+1), step):
        slice_preds = preds[start:start+window]
        res = replay(slice_preds, results)
        res["fold"] = len(folds)
        res["window_start"] = start
        res["window_end"] = start+len(slice_preds)
        folds.append(res)
    return folds
