"""Auth — email/password + TOTP MFA, invite-only, role-based, server-side enforcement."""
from __future__ import annotations
import uuid
import base64
import io
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import jwt, JWTError
from core.config.settings import get_settings
from core.security import hash_password, verify_password, decode_token
from database.auth_store import (
    get_user_by_email, get_user_by_id, list_users, upsert_user, create_user, update_user,
    create_reset_token, consume_reset_token, peek_reset_token
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

# Helpers to create tokens with extra claims
def _create_token(sub: str, extra: dict | None = None, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes or settings.auth.expiration_minutes)
    payload = {"sub": sub, "exp": exp}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.auth.secret_key, algorithm=settings.auth.algorithm)

def _create_temp_mfa_token(user_id: str) -> str:
    # Short-lived temp token for MFA challenge (5 min, mfa_verified false)
    return _create_token(user_id, {"mfa_required": True, "mfa_verified": False}, expires_minutes=5)

def _get_user_from_token(token: str) -> dict | None:
    try:
        payload = decode_token(token)
        uid = payload.get("sub")
        if not uid:
            return None
        user = get_user_by_id(uid)
        return user
    except JWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(401, "Unauthorized — missing token")
    token = credentials.credentials
    try:
        payload = decode_token(token)
        uid = payload.get("sub")
        mfa_verified = payload.get("mfa_verified", True)
        # If token is temp MFA token, not yet verified, deny
        if payload.get("mfa_required"):
            raise HTTPException(401, "MFA required — verify TOTP code")
        if not uid:
            raise HTTPException(401, "Invalid token")
        user = get_user_by_id(uid)
        if not user:
            raise HTTPException(401, "User not found")
        # Check status
        if user.get("status") != "ACTIVE":
            raise HTTPException(403, f"Account {user.get('status')} — contact admin")
        # If user has MFA enabled, require mfa_verified true
        if user.get("mfa_enabled") and not mfa_verified:
            raise HTTPException(401, "MFA verification required")
        return user
    except JWTError as e:
        raise HTTPException(401, f"Invalid token: {str(e)[:80]}")

async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "ADMIN":
        raise HTTPException(403, "Admin access required")
    return user

# Optional auth (for public endpoints that want to know user if present)
async def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> Optional[dict]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

# Models
class LoginIn(BaseModel):
    email: str
    password: str

class MfaVerifyIn(BaseModel):
    temp_token: str
    code: str

class MfaEnrollVerifyIn(BaseModel):
    code: str

class ForgotIn(BaseModel):
    email: str

class ResetIn(BaseModel):
    token: str
    new_password: str

class InviteIn(BaseModel):
    email: str
    role: str = "USER"  # USER or ADMIN

class UpdateUserIn(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

# Endpoints
@router.post("/login")
async def login(body: LoginIn):
    user = get_user_by_email(body.email)
    if not user:
        raise HTTPException(401, "Invalid credentials")
    if user.get("status") == "INVITED":
        raise HTTPException(403, "Account not yet activated — use password reset with invite token")
    if user.get("status") in ("SUSPENDED", "REVOKED"):
        raise HTTPException(403, f"Account {user.get('status')}")
    if not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    # Check MFA
    if user.get("mfa_enabled"):
        temp = _create_temp_mfa_token(user["id"])
        return {"mfa_required": True, "temp_token": temp, "message": "MFA code required"}
    # No MFA — issue fully verified token
    token = _create_token(user["id"], {"mfa_verified": True, "role": user.get("role")})
    return {"access_token": token, "token_type": "bearer", "user": _sanitize(user)}

@router.post("/mfa/verify")
async def mfa_verify(body: MfaVerifyIn):
    # Verify temp token
    try:
        payload = decode_token(body.temp_token)
        uid = payload.get("sub")
        if not payload.get("mfa_required"):
            raise HTTPException(400, "Invalid temp token")
    except JWTError as e:
        raise HTTPException(401, f"Invalid temp token: {e}")
    user = get_user_by_id(uid)
    if not user or not user.get("mfa_enabled") or not user.get("mfa_secret"):
        raise HTTPException(400, "MFA not enrolled for this user")
    # Verify TOTP
    import pyotp
    totp = pyotp.TOTP(user["mfa_secret"])
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(401, "Invalid MFA code")
    token = _create_token(user["id"], {"mfa_verified": True, "role": user.get("role")})
    return {"access_token": token, "token_type": "bearer", "user": _sanitize(user)}

@router.post("/mfa/enroll")
async def mfa_enroll(user: dict = Depends(get_current_user)):
    # Generate new secret, return otpauth_url and qr data uri (but don't enable yet)
    import pyotp, qrcode, io, base64
    # If already has secret but not enabled, reuse; else generate new
    secret = user.get("mfa_secret") or pyotp.random_base32()
    # Save secret as temp (not yet enabled) — store it
    update_user(user["id"], {"mfa_secret": secret})
    # Build otpauth url
    totp = pyotp.TOTP(secret)
    issuer = "Apex Sports"
    label = user.get("email", "apex")
    uri = totp.provisioning_uri(name=label, issuer_name=issuer)
    # Generate QR code as base64 data uri
    qr = qrcode.QRCode(version=1, box_size=6, border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    data_uri = f"data:image/png;base64,{b64}"
    return {"secret": secret, "otpauth_url": uri, "qr_data_uri": data_uri, "message": "Scan with Authenticator app, then verify code to enable"}

@router.post("/mfa/enroll/verify")
async def mfa_enroll_verify(body: MfaEnrollVerifyIn, user: dict = Depends(get_current_user)):
    secret = user.get("mfa_secret")
    if not secret:
        raise HTTPException(400, "No MFA enrollment in progress — call POST /api/auth/mfa/enroll first")
    import pyotp
    totp = pyotp.TOTP(secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(401, "Invalid code — enrollment not verified")
    update_user(user["id"], {"mfa_enabled": True})
    return {"status": "ok", "mfa_enabled": True}

@router.post("/mfa/disable")
async def mfa_disable(user: dict = Depends(get_current_user)):
    update_user(user["id"], {"mfa_enabled": False})
    return {"status": "ok", "mfa_enabled": False}

@router.delete("/mfa")
async def mfa_unenroll(user: dict = Depends(get_current_user)):
    update_user(user["id"], {"mfa_enabled": False, "mfa_secret": None})
    return {"status": "ok", "mfa_enabled": False}

@router.post("/forgot")
async def forgot(body: ForgotIn):
    user = get_user_by_email(body.email)
    # Always return ok to avoid enumeration, but only create token if user exists
    if user:
        token = create_reset_token(body.email)
        # In production, would send email; for controlled testing, return token only in dev
        settings = get_settings()
        if settings.debug or settings.env.value in ("development", "testing"):
            return {"status": "ok", "message": "Reset email would be sent", "reset_token": token, "note": "Dev only: token returned for testing"}
        return {"status": "ok", "message": "If account exists, reset email sent"}
    return {"status": "ok", "message": "If account exists, reset email sent"}

@router.post("/reset")
async def reset(body: ResetIn):
    email = consume_reset_token(body.token)
    if not email:
        raise HTTPException(400, "Invalid or expired reset token")
    user = get_user_by_email(email)
    if not user:
        # Create user if invited? For invite flow, user exists as INVITED
        raise HTTPException(404, "User not found for token")
    # Validate password
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    hashed = hash_password(body.new_password)
    # Activate if was INVITED
    patch = {"password_hash": hashed}
    if user.get("status") == "INVITED":
        patch["status"] = "ACTIVE"
    update_user(user["id"], patch)
    return {"status": "ok", "message": "Password updated", "email": email}

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _sanitize(user)

@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    # Stateless JWT — client should discard token; we could blacklist if needed
    # For now, just return ok; frontend clears storage
    return {"status": "ok"}

# Admin
@router.get("/users")
async def list_users_admin(admin: dict = Depends(get_current_admin)):
    users = list_users()
    return {"users": [_sanitize(u) for u in users], "total": len(users)}

@router.post("/invite")
async def invite(body: InviteIn, admin: dict = Depends(get_current_admin)):
    email = body.email.lower().strip()
    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(400, f"User {email} already exists with status {existing.get('status')}")
    role = body.role.upper() if body.role.upper() in ("ADMIN", "USER") else "USER"
    user = create_user(email=email, role=role, status="INVITED", invited_by=admin.get("email"))
    token = create_reset_token(email)
    # Return invite token for admin to share (dev mode)
    return {"status": "ok", "user": _sanitize(user), "invite_token": token, "message": f"Invite created for {email} as {role} — share reset token to activate"}

@router.patch("/users/{user_id}")
async def update_user_admin(user_id: str, body: UpdateUserIn, admin: dict = Depends(get_current_admin)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    # Prevent self-revocation lockout? Allow but warn
    patch = {}
    if body.role and body.role.upper() in ("ADMIN", "USER"):
        patch["role"] = body.role.upper()
    if body.status and body.status.upper() in ("INVITED", "ACTIVE", "SUSPENDED", "REVOKED"):
        patch["status"] = body.status.upper()
    if not patch:
        raise HTTPException(400, "No valid fields to update")
    updated = update_user(user_id, patch)
    return {"status": "ok", "user": _sanitize(updated)}

@router.delete("/users/{user_id}")
async def delete_user_admin(user_id: str, admin: dict = Depends(get_current_admin)):
    if admin.get("id") == user_id:
        raise HTTPException(400, "Cannot delete yourself")
    from database.auth_store import delete_user as _del
    ok = _del(user_id)
    if not ok:
        raise HTTPException(404, "User not found")
    return {"status": "ok", "deleted": user_id}

@router.get("/admin/health")
async def admin_health(admin: dict = Depends(get_current_admin)):
    # System health for admin
    from scanner.pipeline.state import get_scanner_state
    from providers.registry.provider_registry import registry
    snap = get_scanner_state().get_snapshot()
    health = await registry.health_all() if hasattr(registry, "health_all") else {}
    return {
        "engine": {"state": snap.state, "is_scanning": snap.is_scanning, "total_predictions": snap.total_predictions, "total_scans": snap.total_scans},
        "providers": {k: {"status": v.status.value if hasattr(v.status, "value") else str(v.status), "is_healthy": v.is_healthy, "configured": v.configured} for k, v in health.items()},
        "api": {"status": "ok"},
    }

def _sanitize(user: dict) -> dict:
    # Never expose password_hash, mfa_secret
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "role": user.get("role"),
        "status": user.get("status"),
        "mfa_enabled": bool(user.get("mfa_enabled")),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
        "invited_by": user.get("invited_by"),
    }
