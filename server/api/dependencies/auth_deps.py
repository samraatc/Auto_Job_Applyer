"""
Shared FastAPI dependency functions for authentication.
Import these in route files instead of directly from auth.
"""
from auth import get_current_user_id, require_user

__all__ = ["get_current_user_id", "require_user"]
