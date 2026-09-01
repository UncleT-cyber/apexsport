"""Apex Sports — Event system (adapted from ApexLoop). Sports-specific event types added."""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine, Optional


class EventType(str, Enum):
    # Data / ingestion
    FIXTURE_DISCOVERED = "FIXTURE_DISCOVERED"
    FIXTURE_UPDATED = "FIXTURE_UPDATED"
    ODDS_UPDATED = "ODDS_UPDATED"
    LINEUP_UPDATED = "LINEUP_UPDATED"
    INJURY_DETECTED = "INJURY_DETECTED"
    NEWS_RECEIVED = "NEWS_RECEIVED"
    MATCH_STARTED = "MATCH_STARTED"
    MATCH_FINISHED = "MATCH_FINISHED"
    DATA_RECEIVED = "DATA_RECEIVED"
    DATA_STALE = "DATA_STALE"
    PROVIDER_HEALTH = "PROVIDER_HEALTH"
    DATA_PROVIDER_DOWN = "DATA_PROVIDER_DOWN"

    # Scanner
    SCAN_STARTED = "SCAN_STARTED"
    SCAN_COMPLETED = "SCAN_COMPLETED"
    SCAN_FAILED = "SCAN_FAILED"
    SCANNER_PROGRESS = "SCANNER_PROGRESS"
    SCANNER_PIPELINE_STAGE = "SCANNER_PIPELINE_STAGE"
    SCANNER_FIXTURE_DISCOVERED = "SCANNER_FIXTURE_DISCOVERED"
    SCANNER_FIXTURE_COMPLETE = "SCANNER_FIXTURE_COMPLETE"
    SCANNER_PREDICTION_GENERATED = "SCANNER_PREDICTION_GENERATED"
    SCANNER_VALUE_DETECTED = "SCANNER_VALUE_DETECTED"

    # Intelligence
    FEATURES_COMPUTED = "FEATURES_COMPUTED"
    MODEL_PREDICTION = "MODEL_PREDICTION"
    AI_ANALYSIS_STARTED = "AI_ANALYSIS_STARTED"
    AI_ANALYSIS_COMPLETED = "AI_ANALYSIS_COMPLETED"
    AI_ANALYSIS_FAILED = "AI_ANALYSIS_FAILED"
    ENSEMBLE_COMPUTED = "ENSEMBLE_COMPUTED"
    CALIBRATION_APPLIED = "CALIBRATION_APPLIED"

    # Predictions / value / risk
    PREDICTION_CREATED = "PREDICTION_CREATED"
    PREDICTION_INVALIDATED = "PREDICTION_INVALIDATED"
    VALUE_DETECTED = "VALUE_DETECTED"
    RISK_ASSESSED = "RISK_ASSESSED"
    RISK_BLOCKED = "RISK_BLOCKED"
    RISK_APPROVED = "RISK_APPROVED"

    # Slip
    SLIP_CREATED = "SLIP_CREATED"
    SLIP_VALIDATED = "SLIP_VALIDATED"

    # Copilot
    COPILOT_REQUESTED = "COPILOT_REQUESTED"
    LLM_CONFIG_RESOLVED = "LLM_CONFIG_RESOLVED"
    MODEL_SELECTED = "MODEL_SELECTED"
    REQUEST_SENT = "REQUEST_SENT"
    TOOL_CALL = "TOOL_CALL"
    TOOL_RESULT = "TOOL_RESULT"
    RESPONSE_STARTED = "RESPONSE_STARTED"
    RESPONSE_COMPLETED = "RESPONSE_COMPLETED"
    COPILOT_ERROR = "COPILOT_ERROR"

    # System
    SYSTEM_STARTUP = "SYSTEM_STARTUP"
    SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN"
    ERROR = "ERROR"
    HEALTH_CHECK = "HEALTH_CHECK"


@dataclass
class Event:
    event_type: EventType
    timestamp: float = field(default_factory=time.time)
    event_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    source: str = ""
    data: dict[str, Any] = field(default_factory=dict)
    correlation_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["event_type"] = self.event_type.value
        return d

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


Handler = Callable[[Event], Coroutine[Any, Any, None]]


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[EventType, list[Handler]] = {}
        self._global_handlers: list[Handler] = []
        self._history: list[Event] = []
        self._max_history = 2000

    def on(self, event_type: EventType, handler: Handler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def on_all(self, handler: Handler) -> None:
        self._global_handlers.append(handler)

    def off(self, event_type: EventType, handler: Handler) -> None:
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    async def emit(self, event: Event) -> None:
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]
        handlers = self._handlers.get(event.event_type, []) + self._global_handlers
        for handler in handlers:
            try:
                await handler(event)
            except Exception:
                import traceback
                traceback.print_exc()
        try:
            from apps.api.websocket import broadcaster as _bc  # lazy to avoid cycle
            _bc.push(event)
        except Exception:
            pass

    def emit_sync(self, event: Event) -> None:
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]
        try:
            from apps.api.websocket import broadcaster as _bc
            _bc.push(event)
        except Exception:
            pass

    def get_history(self, event_type: Optional[EventType] = None, limit: int = 50) -> list[Event]:
        events = self._history
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return events[-limit:]


event_bus = EventBus()
