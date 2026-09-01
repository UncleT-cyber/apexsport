"""Risk engine — independent from prediction, explainable."""
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class RiskAssessment:
    level: str  # LOW/MEDIUM/HIGH/BLOCKED
    score: float
    reasons: list[str]
    data_quality: str
    market_quality: str
    blocked: bool

def assess_risk(confidence: float, edge: float, data_quality: str, market_quality: str, correlation: float = 0.0, selection_count: int = 1) -> RiskAssessment:
    reasons: list[str] = []
    score = 0.0
    if confidence < 0.4:
        reasons.append("low confidence")
        score += 0.4
    if edge < 0.03:
        reasons.append("thin edge")
        score += 0.2
    if data_quality != "ok":
        reasons.append(f"data_quality={data_quality}")
        score += 0.3
    if market_quality != "ok":
        reasons.append(f"market_quality={market_quality}")
        score += 0.2
    if correlation > 0.7:
        reasons.append("high correlation")
        score += 0.3
    if selection_count > 5:
        reasons.append("too many selections")
        score += 0.2

    score = min(1.0, score)
    blocked = score >= 0.7 or confidence < 0.35
    level = "BLOCKED" if blocked else ("HIGH" if score >= 0.5 else "MEDIUM" if score >= 0.3 else "LOW")
    return RiskAssessment(level=level, score=score, reasons=reasons, data_quality=data_quality, market_quality=market_quality, blocked=blocked)
