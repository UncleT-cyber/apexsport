"""Base adapter — normalization entrypoint."""
from __future__ import annotations
from typing import Any
from providers.base.provider import SportsDataProvider

class ProviderAdapter(SportsDataProvider):
    """Adapter adds normalization helpers."""
    def normalize_fixture(self, raw: dict[str, Any]) -> dict[str, Any]:
        return raw

    def map_market(self, raw_market: str) -> str:
        return raw_market
