"""Observability: request/latency/failures + scanner telemetry."""
from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Any

@dataclass
class TelemetryEvent:
    name: str
    timestamp: float = field(default_factory=time.time)
    duration_ms: float = 0.0
    provider: str = ""
    success: bool = True
    error: str = ""
    meta: dict[str, Any] = field(default_factory=dict)

class Telemetry:
    def __init__(self) -> None:
        self._events: list[TelemetryEvent] = []

    def record(self, evt: TelemetryEvent) -> None:
        self._events.append(evt)
        if len(self._events) > 1000:
            self._events = self._events[-1000:]

    def recent(self, n: int = 50) -> list[TelemetryEvent]:
        return self._events[-n:]

telemetry = Telemetry()
