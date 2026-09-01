"""Canonical ID helpers."""
import hashlib
import uuid

def new_id(prefix: str = "") -> str:
    uid = uuid.uuid4().hex[:12]
    return f"{prefix}_{uid}" if prefix else uid

def canonical_key(*parts: str) -> str:
    raw = "|".join(p.lower().strip() for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
