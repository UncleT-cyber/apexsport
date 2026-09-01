from __future__ import annotations
from typing import Optional
from datetime import datetime
import httpx
from providers.base.adapter import ProviderAdapter
from providers.base.provider import ProviderCapability, ProviderHealth, ProviderStatus
from core.config.settings import get_runtime_settings

class SportmonksAdapter(ProviderAdapter):
    @property
    def name(self) -> str:
        return "sportmonks"

    def capabilities(self) -> list[ProviderCapability]:
        return [ProviderCapability.FIXTURES, ProviderCapability.LIVESCORE, ProviderCapability.STATISTICS, ProviderCapability.ODDS]

    def is_configured(self) -> bool:
        return bool(get_runtime_settings().sportmonks.api_key)

    async def connect(self) -> None:
        self._connected = True

    async def disconnect(self) -> None:
        self._connected = False

    async def health(self) -> ProviderHealth:
        cfg = get_runtime_settings().sportmonks.api_key
        if not cfg:
            return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.NOT_CONFIGURED, configured=False)
        return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONFIGURED, configured=True, connected=getattr(self, "_connected", False), capabilities=[c.value for c in self.capabilities()])

    async def test_connection(self) -> ProviderHealth:
        if not self.is_configured():
            return await self.health()
        settings = get_runtime_settings().sportmonks
        base = (settings.base_url or "https://api.sportmonks.com/v3").rstrip("/")
        key = settings.api_key
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Sportmonks v3 auth via api_token query; endpoint /leagues is lightweight
                resp = await client.get(f"{base}/football/leagues", params={"api_token": key, "per_page": 1})
                if resp.status_code == 200:
                    return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])
                if resp.status_code in (401,403):
                    return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False, error_message=f"Auth failed {resp.status_code} — check key at my.sportmonks.com", capabilities=[c.value for c in self.capabilities()])
                return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.DEGRADED, configured=True, connected=False, error_message=f"HTTP {resp.status_code}: {resp.text[:120]}", capabilities=[c.value for c in self.capabilities()])
        except Exception as e:
            return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False, error_message=str(e), capabilities=[c.value for c in self.capabilities()])
        return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])

    async def fetch_fixtures(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None, competition: Optional[str] = None) -> list[dict]:
        if not self.is_configured():
            return []
        settings = get_runtime_settings().sportmonks
        base = (settings.base_url or "https://api.sportmonks.com/v3").rstrip("/")
        key = settings.api_key
        from datetime import timedelta, timezone
        import httpx
        # Default window: today → +7 days if no range given
        if not date_from:
            date_from = datetime.now(timezone.utc)
        if not date_to:
            date_to = date_from + timedelta(days=7)
        fixtures: list[dict] = []
        async with httpx.AsyncClient(timeout=12) as client:
            # Prefer single between call to avoid per-day hammering (rate limit 180/hour, 7 calls/scan quickly exhausts free plan)
            # Sportmonks v3: /football/fixtures/between/{from}/{to}
            try:
                from_str = date_from.strftime("%Y-%m-%d")
                to_str = date_to.strftime("%Y-%m-%d")
                resp = await client.get(
                    f"{base}/football/fixtures/between/{from_str}/{to_str}",
                    params={"api_token": key, "include": "participants;league;scores", "per_page": 50},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    raw_list = data.get("data", [])
                    for r in raw_list:
                        participants = r.get("participants", [])
                        home = participants[0].get("name", "Home") if len(participants) > 0 else r.get("name", "Home")
                        away = participants[1].get("name", "Away") if len(participants) > 1 else "Away"
                        league = r.get("league", {})
                        comp = league.get("name", "Unknown") if isinstance(league, dict) else "Unknown"
                        fid = f"sportmonks_{r.get('id')}"
                        fixtures.append({
                            "id": fid,
                            "external_ids": {"sportmonks": str(r.get("id"))},
                            "home": home,
                            "away": away,
                            "home_team": home,
                            "away_team": away,
                            "label": f"{home} vs {away}",
                            "competition": comp,
                            "competition_code": str(league.get("id", "")) if isinstance(league, dict) else "",
                            "kickoff_at": r.get("starting_at") or r.get("starting_at_timestamp"),
                            "venue": (r.get("venue", {}) or {}).get("name") if isinstance(r.get("venue"), dict) else None,
                            "status": str(r.get("state", {}).get("state", "scheduled")).lower() if isinstance(r.get("state"), dict) else "scheduled",
                            "sport": "football",
                        })
                    if fixtures:
                        return fixtures
                # Fallback: per-day if between returns empty / 422 (free plan may not support between)
                if not fixtures:
                    cur = date_from
                    while cur <= date_to:
                        ds = cur.strftime("%Y-%m-%d")
                        try:
                            resp2 = await client.get(
                                f"{base}/football/fixtures/date/{ds}",
                                params={"api_token": key, "include": "participants;league;scores", "per_page": 50},
                            )
                            if resp2.status_code == 200:
                                data2 = resp2.json()
                                raw_list2 = data2.get("data", [])
                                for r in raw_list2:
                                    participants = r.get("participants", [])
                                    home = participants[0].get("name", "Home") if len(participants) > 0 else r.get("name", "Home")
                                    away = participants[1].get("name", "Away") if len(participants) > 1 else "Away"
                                    league = r.get("league", {})
                                    comp = league.get("name", "Unknown") if isinstance(league, dict) else "Unknown"
                                    fid = f"sportmonks_{r.get('id')}"
                                    fixtures.append({
                                        "id": fid,
                                        "external_ids": {"sportmonks": str(r.get("id"))},
                                        "home": home,
                                        "away": away,
                                        "home_team": home,
                                        "away_team": away,
                                        "label": f"{home} vs {away}",
                                        "competition": comp,
                                        "competition_code": str(league.get("id", "")) if isinstance(league, dict) else "",
                                        "kickoff_at": r.get("starting_at") or r.get("starting_at_timestamp"),
                                        "venue": (r.get("venue", {}) or {}).get("name") if isinstance(r.get("venue"), dict) else None,
                                        "status": str(r.get("state", {}).get("state", "scheduled")).lower() if isinstance(r.get("state"), dict) else "scheduled",
                                        "sport": "football",
                                    })
                        except Exception:
                            pass
                        cur += timedelta(days=1)
                        if len(fixtures) >= 40:
                            break
                        # Rate limit guard: 429
                        if resp2.status_code == 429:
                            break
            except Exception:
                pass
        return fixtures

    def normalize_fixture(self, raw: dict) -> dict:
        # Map Sportmonks raw -> canonical keys
        return {
            "external_ids": {"sportmonks": str(raw.get("id", ""))},
            "home": raw.get("home_team") or raw.get("home"),
            "away": raw.get("away_team") or raw.get("away"),
            "kickoff_at": raw.get("kickoff_at") or raw.get("starting_at"),
            "status": raw.get("status"),
        }
