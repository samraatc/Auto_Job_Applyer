# Auth package
# Legacy single-admin auth (used by main.py for backward compatibility)
from .legacy_admin_auth import (
    LoginPayload,
    verify_credentials,
    create_token,
    set_session_cookie,
    clear_session_cookie,
    require_admin,
    change_password,
    validate_token,
)

# Multi-user JWT auth (used by api/ routes)
from .auth_handler import (
    get_current_user_id,
    require_user,
    get_password_hash,
    verify_password,
    create_access_token,
)
