from __future__ import annotations
import json
from datetime import datetime
from typing import Optional
from providers.base.adapter import ProviderAdapter
from providers.base.provider import ProviderCapability, ProviderHealth, ProviderStatus
from core.config.settings import get_runtime_settings

class TheOddsApiAdapter(ProviderAdapter):
    @property
    def name(self) -> str:
        return "the_odds_api"

    def capabilities(self) -> list[ProviderCapability]:
        return [ProviderCapability.ODDS]

    def is_configured(self) -> bool:
        return bool(get_runtime_settings().odds_api.api_key)

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
        settings = get_runtime_settings().odds_api
        base = (settings.base_url or "https://api.the-odds-api.com/v4").rstrip("/")
        key = settings.api_key
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{base}/sports", params={"apiKey": key})
                if resp.status_code == 200:
                    return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])
                if resp.status_code in (401,403):
                    return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False, error_message=f"Auth failed {resp.status_code} — check The Odds API key (the-odds-api.com)", capabilities=[c.value for c in self.capabilities()])
                return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.DEGRADED, configured=True, connected=False, error_message=f"HTTP {resp.status_code}: {resp.text[:120]}", capabilities=[c.value for c in self.capabilities()])
        except Exception as e:
            return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False, error_message=str(e), capabilities=[c.value for c in self.capabilities()])
        return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])

    async def fetch_odds(self, event_id: Optional[str] = None) -> list[dict]:
        if not self.is_configured():
            return []
        settings = get_runtime_settings().odds_api
        base = (settings.base_url or "https://api.the-odds-api.com/v4").rstrip("/")
        key = settings.api_key
        import httpx
        # Map sport to The Odds API sport keys
        # If event_id provided we still need to know sport; try both
        raw_all: list[dict] = []
        # Determine which sport_keys to query — try football and basketball
        # Caller passes event_id which may encode sport, but we query broadly and filter by event_id if given
        sport_keys = ["soccer_epl", "soccer_germany_bundesliga", "soccer_spain_la_liga", "soccer_uefa_champs_league", "basketball_nba"]
        async with httpx.AsyncClient(timeout=12) as client:
            for sk in sport_keys:
                try:
                    # Use h2h + spreads + totals where applicable
                    resp = await client.get(
                        f"{base}/sports/{sk}/odds/",
                        params={
                            "apiKey": key,
                            "regions": "us,uk,eu",
                            "markets": "h2h,spreads,totals",
                            "oddsFormat": "decimal",
                            "dateFormat": "iso",
                        },
                    )
                    if resp.status_code != 200:
                        continue
                    for game in resp.json() or []:
                        gid = game.get("id") or game.get("event_id") or ""
                        # Filter by event_id if requested
                        if event_id and event_id not in str(gid) and event_id != gid:
                            # allow fixture_id contains provider id substring
                            # To avoid fetching all when filtered, skip if not matching
                            # But we still want to support broad scan: if event_id provided and not match, skip
                            if event_id not in json.dumps(game):
                                continue
                        home = game.get("home_team", "Home")
                        away = game.get("away_team", "Away")
                        commence = game.get("commence_time")
                        for bm in game.get("bookmakers", [])[:8]:
                            bname = bm.get("key", "unknown")
                            for mk in bm.get("markets", []):
                                mkey = mk.get("key", "")
                                for out in mk.get("outcomes", []):
                                    # Normalize to our raw format for batch_normalize
                                    name = out.get("name", "")
                                    price = out.get("price")
                                    point = out.get("point")
                                    # Determine selection mapping
                                    sel = "HOME" if name == home else "AWAY" if name == away else name.upper()
                                    if mkey == "h2h":
                                        # sport detection
                                        sport = "basketball" if "basketball" in sk else "football"
                                        raw_all.append({
                                            "event_id": gid,
                                            "id": gid,
                                            "fixture_id": gid,
                                            "market": "h2h",
                                            "selection": sel,
                                            "bookmaker": bname,
                                            "price": price,
                                            "price_decimal": price,
                                            "point": point,
                                            "home": home,
                                            "away": away,
                                            "commence_time": commence,
                                        })
                                    elif mkey in ("spreads", "totals"):
                                        raw_all.append({
                                            "event_id": gid,
                                            "id": gid,
                                            "fixture_id": gid,
                                            "market": mkey,
                                            "selection": name,
                                            "bookmaker": bname,
                                            "price": price,
                                            "price_decimal": price,
                                            "point": point,
                                            "home": home,
                                            "away": away,
                                            "commence_time": commence,
                                        })
                    # avoid hammering
                    if event_id and raw_all:
                        break
                except Exception:
                    continue
                # throttle
                if len(raw_all) > 80:
                    break
        return raw_all

    async def fetch_fixtures(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None, competition: Optional[str] = None) -> list[dict]:
        # The Odds API is ODDS/market data only — not fixture identity. Return empty to keep canonical fixture
        # source separate from market data (Sportmonks/ApiFootball/Sportradar handle fixtures).
        return []
