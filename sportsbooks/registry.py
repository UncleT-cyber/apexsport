from typing import Optional
from sportsbooks.base import SportsbookAdapter

class SportsbookRegistry:
    def __init__(self):
        self._books: dict[str, SportsbookAdapter] = {}
    def register(self, b: SportsbookAdapter):
        self._books[b.name] = b
    def get(self, name: str) -> Optional[SportsbookAdapter]:
        return self._books.get(name)
    def all(self):
        return list(self._books.values())
registry = SportsbookRegistry()
