from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import AsyncIterator, Optional
from pydantic import BaseModel, Field

class ProviderCapability(str, Enum):
    FIXTURES = "fixtures"
    LIVESCORE = "livescore"
    STATISTICS = "statistics"
    LINEUPS = "lineups"
    INJURIES = "injuries"
    ODDS = "odds"
    NEWS = "news"
    STANDINGS = "standings"

class ProviderStatus(str, Enum):
    NOT_CONFIGURED = "not_configured"
    CONFIGURED = "configured"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DEGRADED = "degraded"
    ERROR = "error"
    DISABLED = "disabled"

class ProviderHealth(BaseModel):
    provider: str
    is_healthy: bool = True
    status: ProviderStatus = ProviderStatus.NOT_CONFIGURED
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    consecutive_failures: int = 0
    avg_latency_ms: float = 0.0
    error_message: str = ""
    capabilities: list[str] = Field(default_factory=list)
    configured: bool = False
    connected: bool = False
    model_config = {"frozen": True}

class DataFreshness(BaseModel):
    fetched_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    source_timestamp: Optional[datetime] = None
    latency_ms: float = 0.0
    is_stale: bool = False
    max_age_seconds: float = 60.0
    age_seconds: float = 0.0
    model_config = {"frozen": True}

class SportsDataProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def capabilities(self) -> list[ProviderCapability]: ...

    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def health(self) -> ProviderHealth: ...

    @abstractmethod
    async def test_connection(self) -> ProviderHealth: ...

    # Domain methods (optional capabilities)
    async def fetch_fixtures(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None, competition: Optional[str] = None) -> list[dict]:
        return []

    async def fetch_odds(self, event_id: Optional[str] = None) -> list[dict]:
        return []
