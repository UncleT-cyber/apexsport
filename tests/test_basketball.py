import pytest
from sports.registry import sport_registry
from scanner.universe.discovery import discover_fixtures
from scanner.pipeline.execution import run_fixture_pipeline
from sports.basketball.rules import validate_basketball_selection
from sports.basketball.markets import BasketballMarket

def test_sport_registry_has_both():
    sports = sport_registry.all()
    codes = {s["code"] for s in sports}
    assert "football" in codes
    assert "basketball" in codes

@pytest.mark.asyncio
async def test_basketball_fixtures():
    fixtures = await discover_fixtures(sport="basketball")
    # No hardcoded fixtures — depends on configured providers
    assert isinstance(fixtures, list)
    assert len(fixtures) == 0  # no providers configured in test env

@pytest.mark.asyncio
async def test_basketball_pipeline_market():
    fixture = {"id": "evt_lal_gsw", "label": "LAL vs GSW", "competition": "NBA", "sport": "basketball"}
    pred = await run_fixture_pipeline(fixture)
    # Pipeline returns None when no real LLM configured (no fake predictions)
    assert pred is None  # no specialist outputs without LLM

@pytest.mark.asyncio
async def test_football_pipeline_market():
    fixture = {"id": "evt_ars_che", "label": "ARS vs CHE", "competition": "Premier League", "sport": "football"}
    pred = await run_fixture_pipeline(fixture)
    # Pipeline returns None when no real LLM configured (no fake predictions)
    assert pred is None  # no specialist outputs without LLM

def test_basketball_rules_no_draw():
    ok, _ = validate_basketball_selection(BasketballMarket.MONEYLINE.value, "HOME")
    assert ok
    ok2, msg = validate_basketball_selection(BasketballMarket.MONEYLINE.value, "DRAW")
    assert not ok2
    assert "no draw" in msg.lower()

def test_agents_registered_per_sport():
    import intelligence.agents.wire  # noqa
    from sports.basketball import register_basketball
    try:
        register_basketball()
    except Exception:
        pass
    from intelligence.agents.registry import agent_registry
    names = set(agent_registry.all_names())
    assert {"form_sentinel","team_strength"}.issubset(names)
    assert {"pace_tempo","rebound_rim"}.issubset(names)
    assert len(names) == 12
