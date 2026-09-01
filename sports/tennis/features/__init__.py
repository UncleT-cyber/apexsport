"""Tennis features — isolated from football xG / basketball pace.

Do NOT send football xG or basketball pace into tennis specialists.
"""
from __future__ import annotations

def serve_hold(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "NOT_IMPLEMENTED: tennis serve feed unavailable"}

def break_point(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "NOT_IMPLEMENTED: break point conversion unavailable"}

def register_tennis_features():
    from intelligence.features.feature_registry import feature_registry
    feature_registry.register("tennis", "serve", serve_hold)
    feature_registry.register("tennis", "break_point", break_point)
