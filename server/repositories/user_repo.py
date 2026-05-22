from core.database import db
from schemas.user import UserCreate, UserResponse, UserSettingsBase, UserSettingsResponse
from auth.auth_handler import get_password_hash
from datetime import datetime

class UserRepository:
    @staticmethod
    def get_by_email(email: str):
        if db.get_db() is None:
            return None
        return db.db.users.find_one({"email": email})

    @staticmethod
    def get_by_id(user_id: str):
        if db.get_db() is None:
            return None
        from bson import ObjectId
        return db.db.users.find_one({"_id": ObjectId(user_id)})

    @staticmethod
    def create(user_in: UserCreate):
        if db.get_db() is None:
            return None
        new_user = {
            "email": user_in.email,
            "password_hash": get_password_hash(user_in.password),
            "auth_provider": "local",
            "created_at": datetime.utcnow()
        }
        res = db.db.users.insert_one(new_user)
        new_user["_id"] = str(res.inserted_id)
        return new_user

class SettingsRepository:
    @staticmethod
    def get_settings(user_id: str):
        if db.get_db() is None:
            return None
        return db.db.user_settings.find_one({"user_id": user_id})

    @staticmethod
    def update_settings(user_id: str, settings_in: dict):
        if db.get_db() is None:
            return None
        settings_in["updated_at"] = datetime.utcnow()
        db.db.user_settings.update_one(
            {"user_id": user_id},
            {"$set": settings_in},
            upsert=True
        )
        return SettingsRepository.get_settings(user_id)
