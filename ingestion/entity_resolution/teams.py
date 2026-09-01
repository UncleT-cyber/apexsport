"""Team entity resolution — alias -> canonical."""
from __future__ import annotations
import re

_ALIASES: dict[str, str] = {
    "man utd": "Manchester United",
    "manchester united fc": "Manchester United",
    "arsenal fc": "Arsenal",
    "chelsea fc": "Chelsea",
}

def canonical_team_name(raw: str) -> str:
    key = re.sub(r"\s+", " ", raw.strip().lower())
    return _ALIASES.get(key, raw.strip())

def team_code(name: str) -> str:
    return "".join(w[0] for w in name.split() if w)[:3].upper() or "UNK"
