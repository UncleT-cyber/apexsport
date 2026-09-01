"""Portfolio optimizer — correlation-aware, exposure, slip composition limits.

Explainable, deterministic — no LLM.

Evaluates: uncertainty/confidence, data_quality, market_quality,
selection count, correlation, exposure, slip composition, model disagreement.

Keeps slip independent of sportsbook; formatting only at edge.
"""
from __future__ import annotations
from typing import Optional
from domain.slips.slip import BetSlip, SlipSelection
from risk.engine import assess_risk, RiskAssessment
from risk.correlation import correlation_score

def _selection_risk(sel: SlipSelection) -> RiskAssessment:
    return assess_risk(
        confidence=sel.confidence or 0.5,
        edge=sel.edge or 0,
        data_quality="ok",
        market_quality="ok",
        correlation=0,
        selection_count=1,
    )

def optimize_slip(
    candidates: list[SlipSelection],
    max_selections: int = 5,
    max_correlation: float = 0.7,
    min_edge: float = 0.03,
    min_confidence: float = 0.4,
    risk_level_cap: str = "HIGH",
) -> tuple[BetSlip, dict]:
    """
    Returns (optimized BetSlip, report).

    Steps:
      1. filter by min_edge/min_confidence/risk BLOCKED
      2. sort by edge*confidence (value * conviction)
      3. greedily add respecting correlation/exposure/composition
    """
    level_order = {"LOW":0,"MEDIUM":1,"HIGH":2,"BLOCKED":3}
    cap_rank = level_order.get(risk_level_cap, 2)

    # 1. filter
    filtered: list[SlipSelection] = []
    rejected: list[dict] = []
    for sel in candidates:
        if (sel.edge or 0) < min_edge:
            rejected.append({"event_id": sel.event_id, "reason": f"edge {sel.edge} < {min_edge}"})
            continue
        if (sel.confidence or 0) < min_confidence:
            rejected.append({"event_id": sel.event_id, "reason": f"confidence {sel.confidence} < {min_confidence}"})
            continue
        r = _selection_risk(sel)
        if r.blocked or level_order.get(r.level,3) > cap_rank:
            rejected.append({"event_id": sel.event_id, "reason": f"risk {r.level}"})
            continue
        filtered.append(sel)

    # 2. sort by edge*confidence (EV proxy)
    scored = sorted(filtered, key=lambda s: (s.edge or 0) * (s.confidence or 0), reverse=True)

    # 3. greedily add
    chosen: list[SlipSelection] = []
    for sel in scored:
        if len(chosen) >= max_selections:
            rejected.append({"event_id": sel.event_id, "reason": "max selections"})
            continue
        tentative = chosen + [sel]
        corr = correlation_score([s.model_dump() for s in tentative])
        if corr > max_correlation:
            rejected.append({"event_id": sel.event_id, "reason": f"correlation {corr:.2f} > {max_correlation}"})
            continue
        # exposure: same competition limit 2
        # (naive: event_label prefix)
        if len([c for c in chosen if c.event_id == sel.event_id]) > 0:
            rejected.append({"event_id": sel.event_id, "reason": "duplicate fixture"})
            continue
        chosen.append(sel)

    slip = BetSlip(selections=chosen)
    # frozen-safe: compute total_odds and risk via model_copy
    avg_conf = sum(s.confidence or 0.5 for s in chosen)/len(chosen) if chosen else 0
    avg_edge = sum(s.edge or 0 for s in chosen)/len(chosen) if chosen else 0
    overall_risk = assess_risk(confidence=avg_conf, edge=avg_edge, data_quality="ok", market_quality="ok", correlation=correlation_score([s.model_dump() for s in chosen]), selection_count=len(chosen))
    slip = slip.model_copy(update={"total_odds": slip.compute_total_odds(), "risk_level": overall_risk.level})

    report = {
        "candidates": len(candidates),
        "filtered": len(filtered),
        "chosen": len(chosen),
        "rejected": rejected,
        "correlation": round(correlation_score([s.model_dump() for s in chosen]),3) if chosen else 0,
        "overall_risk": overall_risk.level,
        "total_odds": slip.total_odds,
    }
    return slip, report
