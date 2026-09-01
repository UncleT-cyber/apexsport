from __future__ import annotations
from typing import Optional

class SportRegistry:
    def __init__(self) -> None:
        self._sports: dict[str, dict] = {}

    def register(self, code: str, name: str, domain_module: str) -> None:
        self._sports[code] = {"code": code, "name": name, "domain_module": domain_module}

    def get(self, code: str) -> Optional[dict]:
        return self._sports.get(code)

    def all(self) -> list[dict]:
        return list(self._sports.values())

sport_registry = SportRegistry()
sport_registry.register("football", "Football", "sports.football.domain")
# Basketball registered via sports/basketball/__init__.py:register_basketball()
try:
    from sports.basketball import register_basketball as _rb
    _rb()
except Exception:
    pass
