from intelligence.agents.registry import agent_registry
from intelligence.agents.football.form_sentinel import FormSentinelAgent
from intelligence.agents.football.team_strength import TeamStrengthAgent
from intelligence.agents.football.player_availability import PlayerAvailabilityAgent
from intelligence.agents.football.matchup_analyst import MatchupAnalystAgent
from intelligence.agents.football.market_analyst import MarketAnalystAgent
from intelligence.agents.football.strategy_ensemble import StrategyEnsembleAgent

def wire_agents():
    for cls in [FormSentinelAgent, TeamStrengthAgent, PlayerAvailabilityAgent, MatchupAnalystAgent, MarketAnalystAgent, StrategyEnsembleAgent]:
        try:
            agent_registry.register(cls())
        except Exception:
            pass

wire_agents()
