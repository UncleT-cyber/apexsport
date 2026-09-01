def correlation_score(selections: list[dict]) -> float:
    """Deterministic, explainable correlation — no LLM.

    Factors:
      - duplicate fixture → 0.85 (hard block)
      - same competition → +0.25 per duplicate
      - same market type → +0.10 per duplicate
      - temporal clustering (kickoff within same hour) → +0.15 if 2+ share window

    Caps at 0.90. Keeps optimizer explainable and testable.
    """
    if len(selections) <= 1:
        return 0.0
    # duplicate fixture is max correlation — same event twice is not allowed
    fixtures = [s.get("event_id") for s in selections]
    if len(set(fixtures)) < len(fixtures):
        return 0.85

    score = 0.12  # base — selections in same slip are never fully independent
    # same competition
    comps = [s.get("competition") or s.get("event_label","").split(" ")[0] for s in selections]
    # count most common competition frequency
    from collections import Counter
    if comps:
        most = Counter(comps).most_common(1)[0][1]
        if most >= 2:
            score += 0.18 + 0.07 * (most - 2)
    # same market
    markets = [s.get("market","") for s in selections]
    if markets:
        most_m = Counter(markets).most_common(1)[0][1]
        if most_m >= 2:
            score += 0.08 + 0.04 * (most_m - 2)
    # temporal clustering via kickoff_at if available
    kicks = [s.get("kickoff_at") for s in selections if s.get("kickoff_at")]
    if len(kicks) >= 2:
        try:
            from datetime import datetime
            def _parse(v: str):
                return datetime.fromisoformat(v.replace("Z","+00:00"))
            times = sorted(_parse(k) for k in kicks)
            # if any two within 2 hours
            for i in range(len(times)-1):
                delta_h = (times[i+1] - times[i]).total_seconds()/3600
                if delta_h < 2.0:
                    score += 0.12
                    break
        except Exception:
            pass
    return min(0.90, round(score, 3))
