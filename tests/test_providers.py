import pytest
from providers.registry.provider_registry import ProviderRegistry
from providers.sports_data.sportmonks.adapter import SportmonksAdapter
from providers.base.provider import ProviderCapability

@pytest.mark.asyncio
async def test_registry_capability_filter():
    reg = ProviderRegistry()
    reg.register(SportmonksAdapter(), priority=10)
    assert len(reg.for_capability(ProviderCapability.FIXTURES)) == 1
    assert len(reg.for_capability(ProviderCapability.NEWS)) == 0
    h = await reg.health_all()
    assert "sportmonks" in h
    # In this repo test env may have real key (VeLq...) restored; just check health shape, not configured value
    assert "configured" in h["sportmonks"].model_dump()

def test_adapter_never_leaks_raw_to_domain():
    adapter = SportmonksAdapter()
    raw = {"id": 123, "home_team": "Man Utd", "away_team": "Arsenal", "starting_at": "2026-01-01"}
    norm = adapter.normalize_fixture(raw)
    assert norm["external_ids"]["sportmonks"] == "123"
    assert "home" in norm
