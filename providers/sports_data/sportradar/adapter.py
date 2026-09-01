from __future__ import annotations
from typing import Optional
from datetime import datetime
import httpx
from providers.base.adapter import ProviderAdapter
from providers.base.provider import ProviderCapability, ProviderHealth, ProviderStatus
from core.config.settings import get_runtime_settings

class SportradarAdapter(ProviderAdapter):
    @property
    def name(self) -> str:
        return "sportradar"

    def capabilities(self) -> list[ProviderCapability]:
        return [ProviderCapability.FIXTURES, ProviderCapability.ODDS, ProviderCapability.STATISTICS]

    def is_configured(self) -> bool:
        return bool(get_runtime_settings().sportradar.api_key)

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
        settings = get_runtime_settings().sportradar
        base = (settings.base_url or "https://api.sportradar.com").rstrip("/")
        key = settings.api_key.strip() if settings.api_key else ""
        # Guard: key pasted with whitespace/newline
        key = key.strip()
        try:
            async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
                # Try endpoints in order: trial → production → header auth variant
                # Sportradar keys are scoped to product (trial vs production); try both before failing
                endpoints = [
                    f"{base}/soccer/trial/v4/en/sports.json",
                    f"{base}/soccer/production/v4/en/sports.json",
                    f"{base}/soccer/trial/v4/en/competitions.json",
                    f"{base}/soccer/production/v4/en/competitions.json",
                ]
                last_resp = None
                for url in endpoints:
                    try:
                        # First try query param auth (official: ?api_key=KEY)
                        resp = await client.get(url, params={"api_key": key})
                        last_resp = resp
                        if resp.status_code == 200:
                            return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])
                        # Some enterprise plans use header auth; try header if query failed with 401/403
                        if resp.status_code in (401, 403):
                            resp_h = await client.get(url, headers={"x-api-key": key}, params={})
                            last_resp = resp_h
                            if resp_h.status_code == 200:
                                return ProviderHealth(provider=self.name, is_healthy=True, status=ProviderStatus.CONNECTED, configured=True, connected=True, capabilities=[c.value for c in self.capabilities()])
                            # try next endpoint
                            continue
                        # 404 = wrong product path, try next
                        if resp.status_code == 404:
                            continue
                    except Exception:
                        continue
                # All endpoints failed
                if last_resp is not None:
                    if last_resp.status_code in (401, 403):
                        return ProviderHealth(
                            provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False,
                            error_message=f"Auth failed {last_resp.status_code} — key not valid for soccer trial/production at {base}. Verify in my.sportradar.com → your project → product (trial vs production) matches base path. Response: {last_resp.text[:140]}",
                            capabilities=[c.value for c in self.capabilities()],
                        )
                    return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.DEGRADED, configured=True, connected=False, error_message=f"HTTP {last_resp.status_code}: {last_resp.text[:140]}", capabilities=[c.value for c in self.capabilities()])
        except Exception as e:
            return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.ERROR, configured=True, connected=False, error_message=str(e), capabilities=[c.value for c in self.capabilities()])
        return ProviderHealth(provider=self.name, is_healthy=False, status=ProviderStatus.DEGRADED, configured=True, connected=False, error_message="No successful endpoint — check base URL and product", capabilities=[c.value for c in self.capabilities()])

    async def fetch_fixtures(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None, competition: Optional[str] = None) -> list[dict]:
        return []
