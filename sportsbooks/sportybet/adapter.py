from sportsbooks.base import SportsbookAdapter
class SportyBetAdapter(SportsbookAdapter):
    @property
    def name(self) -> str:
        return "sportybet"
