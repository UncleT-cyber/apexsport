"""Simple broadcaster — mirrors ApexLoop broadcaster but lightweight."""
from __future__ import annotations
import asyncio
import json
from typing import Any

class Broadcaster:
    def __init__(self) -> None:
        self._queues: list[asyncio.Queue] = []

    def push(self, event: Any) -> None:
        try:
            data = event.to_dict() if hasattr(event, "to_dict") else {"data": str(event)}
        except Exception:
            data = {"data": str(event)}
        for q in list(self._queues):
            try:
                q.put_nowait(data)
            except Exception:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._queues:
            self._queues.remove(q)

broadcaster = Broadcaster()
