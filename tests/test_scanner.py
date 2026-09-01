import pytest
from scanner.pipeline.state import get_scanner_state, ScannerState
from market.value import assess_value
from risk.engine import assess_risk
from intelligence.calibration import brier_score

@pytest.mark.asyncio
async def test_scanner_lifecycle():
    state = get_scanner_state()
    await state.start_scan([{"id": "evt_test", "label": "TST vs TST"}])
    assert state.state.is_scanning
    assert state.state.state == ScannerState.INITIALIZING
    await state.complete_scan()
    assert not state.state.is_scanning

def test_value_never_llm():
    v = assess_value(2.0, 0.6)
    assert v.is_value
    assert v.edge > 0.03
    # deterministic
    v2 = assess_value(2.0, 0.6)
    assert v == v2

def test_risk_blocked_low_confidence():
    r = assess_risk(confidence=0.2, edge=0.01, data_quality="poor", market_quality="ok")
    assert r.blocked
    assert r.level == "BLOCKED"

def test_brier():
    assert brier_score([1.0], [1]) == 0.0
    assert brier_score([0.0], [1]) == 1.0
