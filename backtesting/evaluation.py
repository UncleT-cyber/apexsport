"""Evaluation: aggregate metrics across folds."""
from __future__ import annotations

def evaluate_folds(folds: list[dict]) -> dict:
    if not folds:
        return {"folds":0,"avg_accuracy":0,"avg_brier":0}
    acc = sum(f["accuracy"] for f in folds)/len(folds)
    brier = sum(f["brier"] for f in folds)/len(folds)
    return {"folds": len(folds), "avg_accuracy": round(acc,3), "avg_brier": round(brier,4), "folds_detail": folds}
