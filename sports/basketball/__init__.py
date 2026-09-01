"""Basketball sport package — registers sport-specific capabilities without touching platform core."""
from __future__ import annotations

def register_basketball():
    from sports.registry import sport_registry
    sport_registry.register("basketball", "Basketball", "sports.basketball.domain")
    # features / models / prompts / agents
    from sports.basketball.features import register_basketball_features
    from sports.basketball.models import register_basketball_models
    from sports.basketball.agents.wire import wire_basketball_agents
    from intelligence.prompts.registry import prompt_registry, PromptVersion

    register_basketball_features()
    register_basketball_models()
    for agent in ["pace_tempo","shooting_efficiency","rebound_rim","availability_fatigue","matchup_scheme","market_efficiency"]:
        if not prompt_registry.get(agent, "v1"):
            prompt_registry.register(PromptVersion(agent, "v1", f"You are {agent} for basketball. Return structured JSON only."))
    wire_basketball_agents()
