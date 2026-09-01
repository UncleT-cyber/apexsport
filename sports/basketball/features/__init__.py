"""Basketball features — modular, registered via intelligence feature registry.

Generic concept: form/strength/trend/momentum/availability/schedule/fatigue
Basketball-specific impl here.
"""
from __future__ import annotations

def pace(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball pace feed — possessions unavailable"}

def offensive_rating(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball offensive rating feed"}

def defensive_rating(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball defensive rating feed"}

def rebound_rate(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball rebound feed"}

def back_to_back(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball back-to-back feed"}

def three_point_variance(ctx: dict) -> dict:
    return {"_status": "unavailable", "_reason": "no basketball three-point variance feed"}

# Lazy registration to avoid circular import at module load; called from wire
def register_basketball_features():
    from intelligence.features.feature_registry import feature_registry
    feature_registry.register("bb_pace", pace)
    feature_registry.register("bb_offensive_rating", offensive_rating)
    feature_registry.register("bb_defensive_rating", defensive_rating)
    feature_registry.register("bb_rebound_rate", rebound_rate)
    feature_registry.register("bb_back_to_back", back_to_back)
    feature_registry.register("bb_three_point_variance", three_point_variance)
