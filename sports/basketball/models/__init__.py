"""Basketball models — Poisson-ish for football vs pace-adjusted for basketball."""
from __future__ import annotations
from intelligence.models.registry import model_registry, ModelMeta

def register_basketball_models():
    model_registry.register(ModelMeta(id="bb_pace_adjusted_total", version="v1", kind="statistical", sport="basketball"))
    model_registry.register(ModelMeta(id="bb_elo_spread", version="v1", kind="statistical", sport="basketball"))
    model_registry.register(ModelMeta(id="bb_xgb_moneyline", version="v1", kind="ml", sport="basketball"))
    model_registry.register(ModelMeta(id="bb_ensemble_v1", version="v1", kind="ensemble", sport="basketball"))
