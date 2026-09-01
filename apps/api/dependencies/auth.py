"""Auth dependencies for protecting API routes."""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from core.security import decode_token
from database.auth_store import get_user_by_id

security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not credentials or not credentials.credentials:
        raise HTTPException(401, "Unauthorized")
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("mfa_required"):
            raise HTTPException(401, "MFA required")
        uid = payload.get("sub")
        if not uid:
            raise HTTPException(401, "Invalid token")
        user = get_user_by_id(uid)
        if not user:
            raise HTTPException(401, "User not found")
        if user.get("status") != "ACTIVE":
            raise HTTPException(403, f"Account {user.get('status')}")
        if user.get("mfa_enabled") and not payload.get("mfa_verified"):
            raise HTTPException(401, "MFA verification required")
        return user
    except JWTError as e:
        raise HTTPException(401, f"Invalid token: {str(e)[:60]}")

async def get_current_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "ADMIN":
        raise HTTPException(403, "Admin required")
    return user

async def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
