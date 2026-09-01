"""Basketball agent wiring — registered dynamically, sport-scoped via agent name."""
from intelligence.agents.registry import agent_registry

def wire_basketball_agents():
    from sports.basketball.agents.pace_tempo import PaceTempoAgent
    from sports.basketball.agents.shooting_efficiency import ShootingEfficiencyAgent
    from sports.basketball.agents.rebound_rim import ReboundRimAgent
    from sports.basketball.agents.availability_fatigue import AvailabilityFatigueAgent
    from sports.basketball.agents.matchup_scheme import MatchupSchemeAgent
    from sports.basketball.agents.market_efficiency import MarketEfficiencyAgent
    for cls in [PaceTempoAgent, ShootingEfficiencyAgent, ReboundRimAgent, AvailabilityFatigueAgent, MatchupSchemeAgent, MarketEfficiencyAgent]:
        try:
            agent_registry.register(cls())
        except Exception:
            pass
