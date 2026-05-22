from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from auth.auth_handler import (
    verify_password, get_password_hash, create_access_token,
    get_current_user_id, require_user
)
from repositories.user_repo import UserRepository
from core.database import db

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Request / Response models ────────────────────────────────────────
class LoginPayload(BaseModel):
    username: str          # accept username or email
    password: str

class RegisterPayload(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    password: str

class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str

class ProfileUpdatePayload(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

# ── Cookie helper ────────────────────────────────────────────────────
def _set_cookie(response: Response, token: str):
    response.set_cookie(
        key="aja_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,        # set True in production with HTTPS
        max_age=12 * 3600,
        path="/",
    )

# ── Register ─────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
def register(payload: RegisterPayload, response: Response):
    _db = db.get_db()

    # If MongoDB unavailable fall back to the legacy single-admin model
    if _db is None:
        raise HTTPException(status_code=503, detail="Database unavailable – registration requires MongoDB.")

    # Check uniqueness
    existing = _db.users.find_one({"username": payload.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken.")
    if payload.email:
        if _db.users.find_one({"email": payload.email}):
            raise HTTPException(status_code=400, detail="Email already registered.")

    new_user = {
        "username": payload.username,
        "email": payload.email or "",
        "password_hash": get_password_hash(payload.password),
        "auth_provider": "local",
        "created_at": datetime.utcnow(),
    }
    res = _db.users.insert_one(new_user)
    user_id = str(res.inserted_id)

    token = create_access_token(data={"sub": user_id})
    _set_cookie(response, token)
    return {"username": payload.username, "user_id": user_id, "token": token}


# ── Login ─────────────────────────────────────────────────────────────
@router.post("/login")
def login(payload: LoginPayload, response: Response):
    _db = db.get_db()

    # ── MongoDB path ──────────────────────────────────────────────────
    if _db is not None:
        # Try lookup by username first, then by email
        user = _db.users.find_one({"username": payload.username})
        if not user:
            user = _db.users.find_one({"email": payload.username})
        if not user or not verify_password(payload.password, user.get("password_hash", "")):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        user_id = str(user["_id"])
        token = create_access_token(data={"sub": user_id})
        _set_cookie(response, token)
        return {
            "username": user.get("username", payload.username),
            "email": user.get("email", ""),
            "user_id": user_id,
            "token": token,
        }

    # ── Legacy single-admin fallback (no MongoDB) ─────────────────────
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    try:
        from auth import verify_credentials, create_token, set_session_cookie
        if not verify_credentials(payload.username, payload.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token = create_token()
        set_session_cookie(response, token)
        return {"username": payload.username, "user_id": "local-admin", "token": token}
    except ImportError:
        raise HTTPException(status_code=503, detail="Auth system unavailable.")


# ── Logout ────────────────────────────────────────────────────────────
@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("aja_session", path="/")
    return {"ok": True}


# ── Me ────────────────────────────────────────────────────────────────
@router.get("/me")
def me(request: Request):
    """Return current user info. Works for both MongoDB and legacy admin."""
    # Try MongoDB JWT session first
    _db = db.get_db()
    token = request.cookies.get("aja_session")

    if token and _db is not None:
        try:
            from jose import jwt
            from core.config import settings as cfg
            payload = jwt.decode(token, cfg.secret_key, algorithms=[cfg.algorithm])
            user_id = payload.get("sub")
            if user_id:
                from bson import ObjectId
                user = _db.users.find_one({"_id": ObjectId(user_id)})
                if user:
                    return {
                        "username": user.get("username", "admin"),
                        "email": user.get("email", ""),
                        "user_id": str(user["_id"]),
                    }
        except Exception:
            pass

    # Legacy single-admin cookie fallback
    if token:
        try:
            import sys, os
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from auth import validate_token
            if validate_token(token):
                return {"username": "admin", "email": "", "user_id": "local-admin"}
        except Exception:
            pass

    raise HTTPException(status_code=401, detail="Not authenticated")


# ── Profile update ────────────────────────────────────────────────────
@router.put("/profile")
def update_profile(payload: ProfileUpdatePayload, user_id: str = Depends(get_current_user_id)):
    _db = db.get_db()
    if _db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    update = {}
    if payload.username:
        existing = _db.users.find_one({"username": payload.username})
        if existing and str(existing["_id"]) != user_id:
            raise HTTPException(status_code=400, detail="Username already taken.")
        update["username"] = payload.username
    if payload.email:
        update["email"] = payload.email

    if not update:
        return {"ok": True}

    from bson import ObjectId
    _db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    return {"ok": True}


# ── Change password ────────────────────────────────────────────────────
@router.post("/change-password")
def change_password_route(payload: ChangePasswordPayload, request: Request):
    _db = db.get_db()
    token = request.cookies.get("aja_session")

    if _db is not None and token:
        # MongoDB path
        try:
            from jose import jwt
            from core.config import settings as cfg
            data = jwt.decode(token, cfg.secret_key, algorithms=[cfg.algorithm])
            user_id = data.get("sub")
            if user_id:
                from bson import ObjectId
                user = _db.users.find_one({"_id": ObjectId(user_id)})
                if not user or not verify_password(payload.current_password, user.get("password_hash", "")):
                    raise HTTPException(status_code=401, detail="Current password is incorrect.")
                _db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"password_hash": get_password_hash(payload.new_password)}}
                )
                return {"ok": True}
        except HTTPException:
            raise
        except Exception:
            pass

    # Legacy fallback
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from auth import change_password
        change_password(payload.current_password, payload.new_password)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Sessions ────────────────────────────────────────────────────────────
@router.get("/sessions")
def list_sessions():
    """Return stub sessions list — extend with a real sessions collection if needed."""
    return []

@router.post("/sessions/revoke-all")
def revoke_all_sessions():
    return {"ok": True}
