"""Ensemble: combine specialist confidences + model probs into calibrated probability.

Prefer deterministic aggregation over opaque 7th LLM.
"""
from __future__ import annotations
from typing import Optional
import math

def ensemble_probability(model_prob: float, agent_confidences: list[float], weights: Optional[list[float]] = None) -> tuple[float, float]:
    """Return (ensemble_prob, ensemble_confidence). Simple weighted average stub — kept for backwards compat."""
    if not agent_confidences:
        return model_prob, 0.5
    if weights is None:
        weights = [1/len(agent_confidences)] * len(agent_confidences)
    avg_conf = sum(c*w for c, w in zip(agent_confidences, weights))
    blended = model_prob * avg_conf + 0.5 * (1 - avg_conf)
    return round(min(1, max(0, blended)), 3), round(avg_conf, 3)

def ensemble_from_specialists(specialist_outputs, version: str = "v1"):
    """Real ensemble — averages per-selection probabilities weighted by confidence."""
    from intelligence.contracts import EnsembleOutput
    if not specialist_outputs:
        return EnsembleOutput(probabilities={}, disagreement=0, ensemble_confidence=0, version=version)
    # Collect all selection keys
    all_keys = set()
    for out in specialist_outputs:
        all_keys.update(out.probabilities.keys())
    # Weighted average per selection
    total_conf = sum(o.confidence for o in specialist_outputs) or 1
    averaged: dict[str, float] = {}
    for k in all_keys:
        weighted = sum(o.probabilities.get(k, 0) * o.confidence for o in specialist_outputs)
        averaged[k] = weighted / total_conf
    # Normalize to 1.0
    s = sum(averaged.values())
    if s > 0:
        averaged = {k: v/s for k, v in averaged.items()}
    # Disagreement: std of max prob across specialists
    max_probs = []
    for out in specialist_outputs:
        if out.probabilities:
            max_probs.append(max(out.probabilities.values()))
    disagreement = 0
    if len(max_probs) > 1:
        mean = sum(max_probs)/len(max_probs)
        var = sum((x-mean)**2 for x in max_probs)/len(max_probs)
        disagreement = min(1, math.sqrt(var) * 2)
    # Ensemble confidence: avg confidence penalized by disagreement
    avg_conf = sum(o.confidence for o in specialist_outputs)/len(specialist_outputs)
    ensemble_conf = max(0, min(1, avg_conf * (1 - disagreement*0.5)))
    return EnsembleOutput(
        specialist_outputs=specialist_outputs,
        weighting={o.specialist_id: o.confidence/total_conf for o in specialist_outputs},
        probabilities={k: round(v,3) for k, v in averaged.items()},
        disagreement=round(disagreement,3),
        ensemble_confidence=round(ensemble_conf,3),
        version=version,
    )
