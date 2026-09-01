import pytest
from httpx import AsyncClient, ASGITransport
from apps.api.main import app

@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_scanner_state():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/scanner/state")
        assert r.status_code == 200
        j = r.json()
        assert "fixtures_total" in j
        assert "recent_predictions" in j
        # No hardcoded fixtures — depends on configured providers
        assert isinstance(j["fixtures_total"], int)

@pytest.mark.asyncio
async def test_admin():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/admin/agents")
        assert r.status_code == 200
        assert len(r.json()["agents"]) in (6, 12)
        r2 = await ac.get("/api/admin/models")
        assert r2.status_code == 200
        r3 = await ac.get("/api/admin/sports")
        assert r3.status_code == 200
        assert len(r3.json()["sports"]) == 2
