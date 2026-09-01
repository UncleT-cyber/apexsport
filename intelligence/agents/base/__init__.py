"""Base analysis agent — structured output contract (canonical)."""
from __future__ import annotations
from abc import ABC, abstractmethod
from intelligence.contracts import AgentOutput, AgentInput

class AnalysisAgent(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    def version(self) -> str:
        return "v1"

    @abstractmethod
    async def analyze(self, fixture: dict, context: dict) -> AgentOutput: ...

    def enabled(self) -> bool:
        return True
