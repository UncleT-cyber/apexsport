from sportsbooks.base import SportsbookAdapter
class Bet9jaAdapter(SportsbookAdapter):
    @property
    def name(self) -> str:
        return "bet9ja"
