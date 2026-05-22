"""
Single-admin auth using bcrypt + JWT (httpOnly cookie).

On first boot, reads ADMIN_USER / ADMIN_PASS from env. If unset, falls back
to admin / admin (and prints a loud warning). The bcrypt hash and a generated
JWT secret are persisted to server/auth_state.json so restarts keep working
without re-reading env.
"""
from __future__ import annotations

import json
import os
import secrets as _pysecrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
from pydantic import BaseModel

AUTH_STATE_FILE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "auth_state.json"))
COOKIE_NAME = "aja_session"
JWT_ALG = "HS256"
SESSION_HOURS = 12

# When the dashboard is served behind HTTPS, set AJA_HTTPS=true so the session
# cookie is marked Secure + SameSite=strict. Default stays loose for local dev
# (http://localhost serving the Vite frontend on a different origin).
_HTTPS = os.environ.get("AJA_HTTPS", "").lower() in ("1", "true", "yes", "on")
COOKIE_SECURE = _HTTPS
COOKIE_SAMESITE = "strict" if _HTTPS else "lax"


class LoginPayload(BaseModel):
    username: str
    password: str


def _load_state() -> dict:
    if os.path.exists(AUTH_STATE_FILE):
        with open(AUTH_STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_state(state: dict) -> None:
    with open(AUTH_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def _ensure_state() -> dict:
    state = _load_state()
    if "jwt_secret" not in state:
        state["jwt_secret"] = _pysecrets.token_urlsafe(48)
    if "username" not in state or "password_hash" not in state:
        username = os.environ.get("ADMIN_USER", "admin")
        password = os.environ.get("ADMIN_PASS", "admin")
        if password == "admin":
            print("[auth] WARNING: ADMIN_PASS not set — defaulting to 'admin'. Change immediately via /api/auth/change-password.")
        state["username"] = username
        state["password_hash"] = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    _save_state(state)
    return state


def verify_credentials(username: str, password: str) -> bool:
    state = _ensure_state()
    if username != state["username"]:
        return False
    return bcrypt.checkpw(password.encode(), state["password_hash"].encode())


def create_token() -> str:
    state = _ensure_state()
    payload = {
        "sub": state["username"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS),
    }
    return jwt.encode(payload, state["jwt_secret"], algorithm=JWT_ALG)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
        max_age=SESSION_HOURS * 3600,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def require_admin(aja_session: Optional[str] = Cookie(default=None)) -> str:
    if not aja_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    state = _ensure_state()
    try:
        payload = jwt.decode(aja_session, state["jwt_secret"], algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    user = payload.get("sub")
    if user != state["username"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return user


def change_password(current_password: str, new_password: str) -> None:
    state = _ensure_state()
    if not bcrypt.checkpw(current_password.encode(), state["password_hash"].encode()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    state["password_hash"] = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    _save_state(state)


def validate_token(token: str) -> bool:
    """Returns True if the token is a valid, non-expired session token."""
    try:
        state = _ensure_state()
        payload = jwt.decode(token, state["jwt_secret"], algorithms=[JWT_ALG])
        return payload.get("sub") == state["username"]
    except Exception:
        return False


_ensure_state()
