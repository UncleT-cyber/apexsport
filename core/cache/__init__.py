"""Cache respecting provider TTL, event state, freshness, invalidation."""
from __future__ import annotations
import time
from typing import Any, Optional

class TTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float, float]] = {}  # value, expires_at, created_at

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        now = time.time()
        self._store[key] = (value, now + ttl_seconds, now)

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            return None
        value, expires_at, _ = entry
        if time.time() > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        for k in list(self._store.keys()):
            if k.startswith(prefix):
                self._store.pop(k, None)

    def age_seconds(self, key: str) -> Optional[float]:
        entry = self._store.get(key)
        if not entry:
            return None
        _, _, created_at = entry
        return time.time() - created_at

cache = TTLCache()
