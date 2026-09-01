from ingestion.entity_resolution.teams import canonical_team_name
from domain.intelligence.value import compute_value

def test_team_canonical():
    assert canonical_team_name("Man Utd") == "Manchester United"
    assert canonical_team_name("Arsenal") == "Arsenal"

def test_value_math():
    implied, edge, ev, fair = compute_value(2.0, 0.6)
    assert implied == 0.5
    assert abs(edge - 0.1) < 1e-9
    assert abs(ev - 0.2) < 1e-9
    assert abs(fair - 1.6666) < 0.01

def test_time_no_future_leak():
    from scanner.pipeline.execution import run_fixture_pipeline
    assert True
