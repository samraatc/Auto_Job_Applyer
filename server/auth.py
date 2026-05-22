# Backward-compatible shim — real code is in server/auth/legacy_admin_auth.py
from auth.legacy_admin_auth import *  # noqa: F401,F403
from auth.legacy_admin_auth import (
    LoginPayload,
    verify_credentials,
    create_token,
    set_session_cookie,
    clear_session_cookie,
    require_admin,
    change_password,
    validate_token,
)
