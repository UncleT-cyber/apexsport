"""Job/queue abstraction — in-process for now, swappable to Redis/Celery."""
from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine
from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"

@dataclass
class Job:
    id: str
    name: str
    coro: Callable[[], Coroutine[Any, Any, Any]]
    status: JobStatus = JobStatus.PENDING
    result: Any = None
    error: str = ""

class JobRunner:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    async def submit(self, job: Job) -> Job:
        self._jobs[job.id] = job
        job.status = JobStatus.RUNNING
        try:
            job.result = await job.coro()
            job.status = JobStatus.DONE
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error = str(e)
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

runner = JobRunner()
