from ingestion.entity_resolution.teams import canonical_team_name, team_code
from ingestion.normalization.events import normalize_event
from ingestion.freshness import is_fresh
from datetime import datetime, timezone, timedelta

def test_team_resolution_preserves_ids():
    assert canonical_team_name("Manchester United FC") == "Manchester United"
    assert team_code("Manchester United") == "MU"

def test_normalization_canonical_keys():
    raw = {"id": 42, "home_team": "Arsenal", "away_team": "Chelsea", "starting_at": "2026-09-01T15:00:00Z"}
    norm = normalize_event(raw, "sportmonks")
    assert norm["provider"] == "sportmonks"
    assert norm["home"] == "Arsenal"
    assert "raw" in norm
    assert norm["external_id"] == "42"

def test_freshness():
    now = datetime.now(timezone.utc)
    assert is_fresh(now, 60)
    assert not is_fresh(now - timedelta(seconds=120), 60)
