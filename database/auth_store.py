"""Auth store — file-backed user persistence for controlled testing.

Roles: ADMIN, USER
States: INVITED, ACTIVE, SUSPENDED, REVOKED
MFA: TOTP secret, mfa_enabled
No hardcoded admins — role stored persistently.
"""
from __future__ import annotations
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

STORE_FILE = Path(__file__).parent / "users.json"
RESET_FILE = Path(__file__).parent / "reset_tokens.json"

def _load_users() -> Dict[str, dict]:
    if STORE_FILE.exists():
        try:
            return json.loads(STORE_FILE.read_text())
        except Exception:
            return {}
    return {}

def _save_users(data: Dict[str, dict]) -> None:
    STORE_FILE.write_text(json.dumps(data, indent=2))

def _load_resets() -> Dict[str, dict]:
    if RESET_FILE.exists():
        try:
            return json.loads(RESET_FILE.read_text())
        except Exception:
            return {}
    return {}

def _save_resets(data: Dict[str, dict]) -> None:
    RESET_FILE.write_text(json.dumps(data, indent=2))

def list_users() -> list[dict]:
    return list(_load_users().values())

def get_user_by_id(uid: str) -> Optional[dict]:
    return _load_users().get(uid)

def get_user_by_email(email: str) -> Optional[dict]:
    email = email.lower().strip()
    for u in _load_users().values():
        if u.get("email", "").lower() == email:
            return u
    return None

def upsert_user(user: dict) -> dict:
    data = _load_users()
    data[user["id"]] = user
    _save_users(data)
    return user

def delete_user(uid: str) -> bool:
    data = _load_users()
    if uid in data:
        del data[uid]
        _save_users(data)
        return True
    return False

def create_user(email: str, role: str = "USER", status: str = "INVITED", password_hash: Optional[str] = None, invited_by: Optional[str] = None) -> dict:
    uid = f"user_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    user = {
        "id": uid,
        "email": email.lower().strip(),
        "role": role if role in ("ADMIN", "USER") else "USER",
        "status": status if status in ("INVITED", "ACTIVE", "SUSPENDED", "REVOKED") else "INVITED",
        "password_hash": password_hash,
        "mfa_secret": None,
        "mfa_enabled": False,
        "created_at": now,
        "updated_at": now,
        "invited_by": invited_by,
    }
    upsert_user(user)
    return user

def update_user(uid: str, patch: dict) -> Optional[dict]:
    data = _load_users()
    if uid not in data:
        return None
    data[uid].update(patch)
    data[uid]["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_users(data)
    return data[uid]

# Reset tokens
def create_reset_token(email: str) -> str:
    token = uuid.uuid4().hex + uuid.uuid4().hex
    data = _load_resets()
    data[token] = {
        "email": email.lower().strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
    }
    _save_resets(data)
    return token

def consume_reset_token(token: str) -> Optional[str]:
    data = _load_resets()
    rec = data.get(token)
    if not rec:
        return None
    # check expiry
    try:
        exp = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp:
            del data[token]
            _save_resets(data)
            return None
    except Exception:
        pass
    email = rec["email"]
    del data[token]
    _save_resets(data)
    return email

def peek_reset_token(token: str) -> Optional[dict]:
    return _load_resets().get(token)

# Bootstrap: ensure at least one admin exists for initial access (invite-only, but need seed admin)
def ensure_bootstrap_admin() -> Optional[dict]:
    users = list_users()
    if any(u.get("role") == "ADMIN" for u in users):
        return None
    # No admin yet — create invite for first admin via env or default
    # For controlled testing, we create an admin invite that can be claimed via reset flow
    # Do not hardcode email in source as admin check — create placeholder admin that must be activated via invite
    return None
