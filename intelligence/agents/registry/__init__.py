from __future__ import annotations
from typing import Optional
from intelligence.agents.base import AnalysisAgent

class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, AnalysisAgent] = {}

    def register(self, agent: AnalysisAgent) -> None:
        self._agents[agent.name] = agent

    def get(self, name: str) -> Optional[AnalysisAgent]:
        return self._agents.get(name)

    def all(self) -> list[AnalysisAgent]:
        # Source of truth: persisted agents in settings.json via brain
        try:
            from intelligence.brain import get_enabled_agents
            enabled = get_enabled_agents()
            return [a for a in self._agents.values() if a.enabled() and enabled.get(a.name, True)]
        except Exception:
            return [a for a in self._agents.values() if a.enabled()]

    def all_enabled(self) -> list[AnalysisAgent]:
        return self.all()

    def enabled_map(self) -> dict[str, bool]:
        try:
            from intelligence.brain import get_enabled_agents
            return get_enabled_agents()
        except Exception:
            return {k: True for k in self._agents.keys()}

    def all_names(self) -> list[str]:
        return list(self._agents.keys())

agent_registry = AgentRegistry()
