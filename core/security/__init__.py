"""Security: secrets server-side, auth helpers."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from passlib.context import CryptContext
from core.config.settings import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__ident="2b", bcrypt__truncate_error=False)
# Workaround for bcrypt 5.x wrap bug detection
try:
    import bcrypt as _b
    if not hasattr(_b, "__about__"):
        _b.__about__ = type("obj", (), {"__version__": getattr(_b, "__version__", "5.0.0")})()
except Exception:
    pass

def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(sub: str, expires_minutes: Optional[int] = None) -> str:
    settings = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or settings.auth.expiration_minutes)
    payload = {"sub": sub, "exp": exp}
    return jwt.encode(payload, settings.auth.secret_key, algorithm=settings.auth.algorithm)

def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.auth.secret_key, algorithms=[settings.auth.algorithm])
