from __future__ import annotations
from enum import Enum
from pydantic import BaseModel

class SportCode(str, Enum):
    FOOTBALL = "football"
    BASKETBALL = "basketball"
    TENNIS = "tennis"

class Sport(BaseModel):
    code: SportCode
    name: str
    active: bool = True
    model_config = {"frozen": True}
