from datetime import datetime, timezone

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def is_stale(fetched_at: datetime, max_age_seconds: float) -> bool:
    return (utcnow() - fetched_at).total_seconds() > max_age_seconds
