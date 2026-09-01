from sportsbooks.base import SportsbookAdapter
class GenericAdapter(SportsbookAdapter):
    @property
    def name(self) -> str:
        return "generic"
