"""Odds normalization: provider → OddsSnapshot (canonical), with implied/fair edge/EV.

Handles basketball totals/spreads nuances: lines with handicap/points.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from domain.markets.odds import OddsSnapshot
from market.mapping import to_canonical
from market.canonical import is_valid_for_sport

def normalize_odds(raw: dict, sport: str = "football") -> Optional[OddsSnapshot]:
    """
    raw example The Odds API basketball:
      {"id":"evt_lal_gsw","market":"spreads","selection":"HOME","bookmaker":"draftkings","price":1.91,"point":-5.5}
    raw example football 1x2:
      {"event_id":"evt_ars_che","market":"1x2","selection":"HOME","bookmaker":"bet9ja","price_decimal":2.10}
    """
    event_id = raw.get("event_id") or raw.get("id") or raw.get("fixture_id") or "unknown"
    raw_market = raw.get("market") or raw.get("market_key") or "unknown"
    canonical, _trace = to_canonical(raw_market, sport=sport)
    if not canonical:
        return None
    # selection normalization: basketball totals/spreads include line
    sel = str(raw.get("selection") or raw.get("name") or raw.get("outcome") or "UNKNOWN").upper()
    point = raw.get("point") or raw.get("handicap") or raw.get("line")
    if point is not None and canonical.value in ("SPREAD","TOTAL_POINTS","TEAM_TOTAL"):
        # Canonical selection format: SPREAD_HOME_-5.5, OVER_220.5 etc.
        try:
            # normalize: OVER -> OVER_220.5, SPREAD HOME -5.5 -> HOME_-5.5
            if canonical.value == "TOTAL_POINTS":
                # raw selection often OVER/UNDER with point
                base = "OVER" if "OVER" in sel else "UNDER" if "UNDER" in sel else sel
                sel = f"{base}_{float(point)}"
            elif canonical.value == "SPREAD":
                sel = f"{sel}_{float(point):+.1f}"
        except Exception:
            pass
    price = raw.get("price_decimal") or raw.get("price") or raw.get("odds") or 0
    try:
        price = float(price)
    except Exception:
        return None
    if price <= 1:
        return None
    implied = 1.0/price if price > 1 else 0
    # freshness: live odds stale after 10s
    is_stale = False
    captured = raw.get("captured_at")
    if isinstance(captured, str):
        try:
            dt = datetime.fromisoformat(captured.replace("Z","+00:00"))
            is_stale = (datetime.now(timezone.utc) - dt).total_seconds() > 10
        except Exception:
            pass
    return OddsSnapshot(
        event_id=event_id,
        market=canonical.value,
        selection=sel,
        bookmaker=str(raw.get("bookmaker") or raw.get("book") or "unknown").lower(),
        price_decimal=price,
        implied_probability=implied,
        captured_at=datetime.now(timezone.utc),
        is_stale=is_stale,
    )

def batch_normalize(raw_list: list[dict], sport: str = "football") -> list[OddsSnapshot]:
    out: list[OddsSnapshot] = []
    for raw in raw_list:
        norm = normalize_odds(raw, sport=sport)
        if norm:
            out.append(norm)
    return out
