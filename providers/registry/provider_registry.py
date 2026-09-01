"""Apex Sports — Provider Registry (hot-swappable)."""
from __future__ import annotations
from typing import Optional
from providers.base.provider import ProviderCapability, ProviderHealth, ProviderStatus, SportsDataProvider

class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, SportsDataProvider] = {}
        self._priority: list[str] = []
        self._health: dict[str, ProviderHealth] = {}

    def register(self, provider: SportsDataProvider, priority: int = 100) -> None:
        self._providers[provider.name] = provider
        # insert by priority
        self._priority.append(provider.name)
        self._priority.sort(key=lambda n: priority)

    def get(self, name: str) -> Optional[SportsDataProvider]:
        return self._providers.get(name)

    def all(self) -> list[SportsDataProvider]:
        return [self._providers[n] for n in self._priority if n in self._providers]

    def for_capability(self, cap: ProviderCapability) -> list[SportsDataProvider]:
        return [p for p in self.all() if cap in p.capabilities()]

    def set_priority(self, order: list[str]) -> None:
        # reorder to match given order, keep unknowns at end
        known = [n for n in order if n in self._providers]
        unknown = [n for n in self._priority if n not in known]
        self._priority = known + unknown

    async def health_all(self) -> dict[str, ProviderHealth]:
        result: dict[str, ProviderHealth] = {}
        for p in self.all():
            try:
                h = await p.health()
            except Exception as e:
                h = ProviderHealth(provider=p.name, is_healthy=False, status=ProviderStatus.ERROR, error_message=str(e), configured=p.is_configured())
            result[p.name] = h
            self._health[p.name] = h
        return result

    async def best_for(self, cap: ProviderCapability) -> Optional[SportsDataProvider]:
        candidates = self.for_capability(cap)
        # filter healthy/configured first
        healthy = [c for c in candidates if self._health.get(c.name, ProviderHealth(provider=c.name)).is_healthy]
        if healthy:
            return healthy[0]
        return candidates[0] if candidates else None

registry = ProviderRegistry()
