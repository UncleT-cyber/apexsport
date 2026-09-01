from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field

class ModelMeta(BaseModel):
    id: str
    version: str
    kind: str  # statistical / ml / ensemble
    sport: str = "football"
    active: bool = True
    model_config = {"frozen": True}

class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, ModelMeta] = {}

    def register(self, m: ModelMeta) -> None:
        self._models[f"{m.id}:{m.version}"] = m

    def get(self, id: str, version: str) -> Optional[ModelMeta]:
        return self._models.get(f"{id}:{version}")

    def active_for_sport(self, sport: str) -> list[ModelMeta]:
        return [m for m in self._models.values() if m.sport == sport and m.active]

model_registry = ModelRegistry()
model_registry.register(ModelMeta(id="poisson_goals", version="v1", kind="statistical"))
model_registry.register(ModelMeta(id="xgb_match_result", version="v1", kind="ml"))
model_registry.register(ModelMeta(id="ensemble_v1", version="v1", kind="ensemble"))
