"""News provider — normalized, timestamped, entity-linked, deduplicated, ranked."""
from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class NewsItem(BaseModel):
    id: str
    title: str
    body: str = ""
    source: str
    published_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    url: Optional[str] = None
    entities: list[str] = Field(default_factory=list)  # linked team/player/fixture ids
    relevance_score: float = Field(ge=0, le=1, default=0.5)
    dedup_key: str = ""  # hash(title+entities)
    model_config = {"frozen": True}

class NewsProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def fetch_news(self, sport: str = "football", limit: int = 20) -> list[NewsItem]: ...

    def is_configured(self) -> bool:
        return True
