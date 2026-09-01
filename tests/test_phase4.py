import pytest
from market.canonical import CanonicalMarket, is_valid_for_sport
from market.mapping import to_canonical
from market.odds import normalize_odds
from sportsbooks.mappings import to_sportsbook_market
from slips.optimizer import optimize_slip
from domain.slips.slip import SlipSelection

def test_canonical_sport_validation():
    assert is_valid_for_sport("MONEYLINE","basketball")
    assert not is_valid_for_sport("BTTS","basketball")
    assert is_valid_for_sport("BTTS","football")
    assert not is_valid_for_sport("SPREAD","football")

def test_provider_mapping_basketball():
    canon, _ = to_canonical("h2h","basketball")
    assert canon == CanonicalMarket.MONEYLINE
    canon2, _ = to_canonical("spreads","basketball")
    assert canon2 == CanonicalMarket.SPREAD
    canon3, _ = to_canonical("totals","basketball")
    assert canon3 == CanonicalMarket.TOTAL_POINTS
    # football map still works
    c4,_ = to_canonical("1x2","football")
    assert c4 == CanonicalMarket.MATCH_RESULT

def test_odds_normalization_spread_line():
    raw = {"id":"evt_lal_gsw","market":"spreads","selection":"HOME","bookmaker":"draftkings","price":1.91,"point":-5.5}
    snap = normalize_odds(raw, sport="basketball")
    assert snap is not None
    assert snap.market == "SPREAD"
    assert snap.selection == "HOME_-5.5"
    assert snap.price_decimal == 1.91

def test_odds_normalization_total_over():
    raw = {"id":"evt_lal_gsw","market":"totals","selection":"OVER","bookmaker":"draftkings","price":1.90,"point":228.5}
    snap = normalize_odds(raw, sport="basketball")
    assert snap.market == "TOTAL_POINTS"
    assert snap.selection == "OVER_228.5"

def test_sportsbook_mapping():
    assert to_sportsbook_market("MONEYLINE","draftkings") == "h2h"
    assert to_sportsbook_market("SPREAD","draftkings") == "spreads"
    assert to_sportsbook_market("MATCH_RESULT","sportybet") == "1x2"
    assert to_sportsbook_market("MONEYLINE","sportybet") == "1x2"
    assert to_sportsbook_market("TOTAL_POINTS","bet9ja") == "Total Points"

def test_optimizer_correlation_aware():
    cands = [
        SlipSelection(event_id="evt_a", event_label="A vs B", market="MONEYLINE", selection="HOME", odds=2.0, edge=0.1, confidence=0.6),
        SlipSelection(event_id="evt_a", event_label="A vs B", market="SPREAD", selection="HOME_-5.5", odds=1.91, edge=0.08, confidence=0.55),
        SlipSelection(event_id="evt_b", event_label="C vs D", market="MONEYLINE", selection="AWAY", odds=2.2, edge=0.12, confidence=0.65),
    ]
    slip, report = optimize_slip(cands, max_selections=3, max_correlation=0.7)
    # duplicate fixture should be rejected due to correlation/duplicate
    assert len(slip.selections) <= 2
    assert report["chosen"] <= 2
    assert any("duplicate" in r["reason"] or "correlation" in r["reason"] for r in report["rejected"])

def test_optimizer_filters_edge():
    cands = [
        SlipSelection(event_id="evt_x", event_label="X vs Y", market="MATCH_RESULT", selection="HOME", odds=1.5, edge=0.01, confidence=0.9),
        SlipSelection(event_id="evt_y", event_label="Y vs Z", market="MATCH_RESULT", selection="AWAY", odds=3.0, edge=0.1, confidence=0.6),
    ]
    slip, report = optimize_slip(cands, min_edge=0.03)
    assert len(slip.selections) == 1
    assert slip.selections[0].event_id == "evt_y"

def test_booking_code_never_invented():
    from sportsbooks.base import SportsbookAdapter
    from sportsbooks.sportybet.adapter import SportyBetAdapter
    from domain.slips.slip import BetSlip
    adapter = SportyBetAdapter()
    slip = BetSlip(selections=[], sportsbook="sportybet")
    fmt = adapter.format_slip(slip)
    assert "booking_code" not in fmt
    slip.booking_code = "USER123"
    fmt2 = adapter.format_slip(slip)
    assert fmt2["booking_code"] == "USER123"
