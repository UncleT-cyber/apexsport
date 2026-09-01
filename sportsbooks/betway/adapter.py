from sportsbooks.base import SportsbookAdapter
class BetwayAdapter(SportsbookAdapter):
    @property
    def name(self) -> str:
        return "betway"
