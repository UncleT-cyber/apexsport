from __future__ import annotations
from datetime import datetime
from typing import Optional
from providers.base.adapter import ProviderAdapter
from providers.base.provider import ProviderCapability, ProviderHealth, ProviderStatus
from core.config.settings import get_runtime_settings

class ApiFootballAdapter(ProviderAdapter):
    @property
    def name(self) -> str:
        return "api_football"

    def capabilities(self) -> list[ProviderCapability]:
        return [ProviderCapability.FIXTURES, ProviderCapability.STATISTICS, ProviderCapability.LINEUPS, ProviderCapability.INJURIES]

    def is_configured(self) -> bool:
        return bool(get_runtime_settings().api_football.api_key)

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False

    async def health(self) -> ProviderHealth:
        if not self.is_configured():
            return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.NOT_CONFIGURED, configured=False)
        return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONFIGURED, configured=True, connected=getattr(self, "_connected", False), capabilities=[c.value for c in self.capabilities()])

    async def test_connection(self) -> ProviderHealth:
        if not self.is_configured():
            return await self.health()
        settings = get_runtime_settings().api_football
        base = (settings.base_url or "https://v3.football.api-sports.io").rstrip("/")
        key = settings.api_key
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/status", headers={"x-apisports-key": key})
                if resp.status_code == 200:
                    j = resp.json()
                    # api-sports returns {response:{account:{firstname...}}}
                    if resp.headers.get("x-ratelimit-requests-remaining"):
                        return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])
                    return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])
                if resp.status_code in (401,403):
                    return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False, error_message=f"Auth failed {resp.status_code} — check API-Football key (api-sports.io)", capabilities=[c.value for c in self.capabilities()])
                return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.DEGRADED, configured=True, connected=False, error_message=f"HTTP {resp.status_code}: {resp.text[:120]}", capabilities=[c.value for c in self.capabilities()])
        except Exception as e:
            return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False, error_message=str(e), capabilities=[c.value for c in self.capabilities()])
        return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])

    async def fetch_fixtures(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None, competition: Optional[str] = None) -> list[dict]:
        if not self.is_configured():
            return []
        settings = get_runtime_settings().api_football
        base = (settings.base_url or "https://v3.football.api-sports.io").rstrip("/")
        key = settings.api_key
        from datetime import timedelta, timezone
        import httpx
        if not date_from:
            date_from = datetime.now(timezone.utc)
        if not date_to:
            date_to = date_from + timedelta(days=7)
        fixtures: list[dict] = []
        async with httpx.AsyncClient(timeout=12) as client:
            # Prefer single range call to avoid per-day hammering (free plan 100/day)
            # Try ?from= & ?to= first, fallback to ?next=20, fallback to per-day
            try:
                from_str = date_from.strftime("%Y-%m-%d")
                to_str = date_to.strftime("%Y-%m-%d")
                resp = await client.get(
                    f"{base}/fixtures",
                    headers={"x-apisports-key": key},
                    params={"from": from_str, "to": to_str},
                )
                if resp.status_code == 200:
                    j = resp.json()
                    # Some plans don't support from/to, will return error; check results
                    if j.get("results", 0) > 0:
                        for r in j.get("response", [])[:40]:
                            fixture = r.get("fixture", {})
                            league = r.get("league", {})
                            teams = r.get("teams", {})
                            fid = f"api_football_{fixture.get('id')}"
                            home = teams.get("home", {}).get("name", "Home")
                            away = teams.get("away", {}).get("name", "Away")
                            fixtures.append({
                                "id": fid,
                                "external_ids": {"api_football": str(fixture.get("id"))},
                                "home": home,
                                "away": away,
                                "home_team": home,
                                "away_team": away,
                                "label": f"{home} vs {away}",
                                "competition": league.get("name", "Unknown"),
                                "competition_code": str(league.get("id", "")),
                                "kickoff_at": fixture.get("date"),
                                "venue": (fixture.get("venue", {}) or {}).get("name"),
                                "status": str(fixture.get("status", {}).get("short", "NS")).lower(),
                                "sport": "football",
                            })
                        if fixtures:
                            return fixtures
                # Fallback: ?next=20 (upcoming fixtures, single call)
                resp2 = await client.get(
                    f"{base}/fixtures",
                    headers={"x-apisports-key": key},
                    params={"next": 20},
                )
                if resp2.status_code == 200:
                    j2 = resp2.json()
                    if j2.get("results", 0) > 0:
                        for r in j2.get("response", [])[:40]:
                            fixture = r.get("fixture", {})
                            league = r.get("league", {})
                            teams = r.get("teams", {})
                            fid = f"api_football_{fixture.get('id')}"
                            home = teams.get("home", {}).get("name", "Home")
                            away = teams.get("away", {}).get("name", "Away")
                            fixtures.append({
                                "id": fid,
                                "external_ids": {"api_football": str(fixture.get("id"))},
                                "home": home,
                                "away": away,
                                "home_team": home,
                                "away_team": away,
                                "label": f"{home} vs {away}",
                                "competition": league.get("name", "Unknown"),
                                "competition_code": str(league.get("id", "")),
                                "kickoff_at": fixture.get("date"),
                                "venue": (fixture.get("venue", {}) or {}).get("name"),
                                "status": str(fixture.get("status", {}).get("short", "NS")).lower(),
                                "sport": "football",
                            })
                        if fixtures:
                            return fixtures
            except Exception:
                pass
            # Last fallback: per-day (only if still empty, but limit to 3 days to save quota)
            if not fixtures:
                cur = date_from
                days_tried = 0
                while cur <= date_to and days_tried < 3:
                    ds = cur.strftime("%Y-%m-%d")
                    try:
                        resp3 = await client.get(
                            f"{base}/fixtures",
                            headers={"x-apisports-key": key},
                            params={"date": ds},
                        )
                        if resp3.status_code == 200:
                            j3 = resp3.json()
                            for r in j3.get("response", [])[:20]:
                                fixture = r.get("fixture", {})
                                league = r.get("league", {})
                                teams = r.get("teams", {})
                                fid = f"api_football_{fixture.get('id')}"
                                home = teams.get("home", {}).get("name", "Home")
                                away = teams.get("away", {}).get("name", "Away")
                                fixtures.append({
                                    "id": fid,
                                    "external_ids": {"api_football": str(fixture.get("id"))},
                                    "home": home,
                                    "away": away,
                                    "home_team": home,
                                    "away_team": away,
                                    "label": f"{home} vs {away}",
                                    "competition": league.get("name", "Unknown"),
                                    "competition_code": str(league.get("id", "")),
                                    "kickoff_at": fixture.get("date"),
                                    "venue": (fixture.get("venue", {}) or {}).get("name"),
                                    "status": str(fixture.get("status", {}).get("short", "NS")).lower(),
                                    "sport": "football",
                                })
                        if resp3.status_code == 429:
                            break
                    except Exception:
                        pass
                    cur += timedelta(days=1)
                    days_tried += 1
                    if len(fixtures) >= 20:
                        break
        return fixtures
