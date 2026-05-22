"""
Authentication service — business logic for user auth.
Controllers should call these methods, not query DB directly.
"""
from typing import Optional
from datetime import datetime

from auth.auth_handler import get_password_hash, verify_password, create_access_token
from database.mongo_client import get_db


class AuthService:
    @staticmethod
    def get_user_by_username(username: str) -> Optional[dict]:
        _db = get_db()
        if _db is None:
            return None
        return _db.users.find_one({"username": username})

    @staticmethod
    def get_user_by_email(email: str) -> Optional[dict]:
        _db = get_db()
        if _db is None:
            return None
        return _db.users.find_one({"email": email})

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[dict]:
        _db = get_db()
        if _db is None:
            return None
        from bson import ObjectId
        return _db.users.find_one({"_id": ObjectId(user_id)})

    @staticmethod
    def create_user(username: str, email: str, password: str) -> Optional[dict]:
        _db = get_db()
        if _db is None:
            return None
        doc = {
            "username": username,
            "email": email,
            "password_hash": get_password_hash(password),
            "auth_provider": "local",
            "created_at": datetime.utcnow(),
            "is_active": True,
        }
        result = _db.users.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc

    @staticmethod
    def authenticate(username_or_email: str, password: str) -> Optional[dict]:
        """Verify credentials; returns user doc or None."""
        user = AuthService.get_user_by_username(username_or_email)
        if not user:
            user = AuthService.get_user_by_email(username_or_email)
        if not user:
            return None
        if not verify_password(password, user.get("password_hash", "")):
            return None
        return user

    @staticmethod
    def create_session_token(user_id: str) -> str:
        return create_access_token(data={"sub": user_id})
