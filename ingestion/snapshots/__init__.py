"""Snapshots for reproducibility — preserve data/fixture/odds at prediction time."""
import copy
from datetime import datetime, timezone
def snapshot(data: dict) -> dict:
    return {"data": copy.deepcopy(data), "snapshot_at": datetime.now(timezone.utc).isoformat()}
