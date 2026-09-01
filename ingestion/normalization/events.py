"""Normalization: raw provider fixture -> canonical Event keys."""
from __future__ import annotations
from typing import Any

def normalize_event(raw: dict[str, Any], provider: str) -> dict[str, Any]:
    # canonical fields
    return {
        "provider": provider,
        "external_id": str(raw.get("id") or raw.get("fixture_id") or raw.get("external_id") or ""),
        "home": (raw.get("home_team") or raw.get("home") or raw.get("teams", {}).get("home", {}).get("name") or "").strip(),
        "away": (raw.get("away_team") or raw.get("away") or raw.get("teams", {}).get("away", {}).get("name") or "").strip(),
        "kickoff_at": raw.get("kickoff_at") or raw.get("starting_at") or raw.get("fixture", {}).get("date"),
        "status": raw.get("status") or "scheduled",
        "competition": raw.get("competition") or raw.get("league", {}).get("name") or "Unknown",
        "raw": raw,
    }
