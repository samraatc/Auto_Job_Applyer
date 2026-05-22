from core.database import db
from security.encryption import decrypt
import sys
import os

class BotConfigLoader:
    def __init__(self, user_id: str):
        self.user_id = user_id
        db.connect() # Ensure DB is connected in worker process

    def get_settings(self):
        settings = db.db.user_settings.find_one({"user_id": self.user_id})
        if not settings:
            return {}
        
        # Decrypt sensitive fields
        for field in ["linkedin_pass", "openai_api_key", "gemini_api_key", "anthropic_api_key", "groq_api_key", "deepseek_api_key"]:
            if settings.get(field):
                settings[field] = decrypt(settings[field])
        
        return settings

    def get_search_rules(self):
        return db.db.search_rules.find_one({"user_id": self.user_id}) or {}

    def get_target_companies(self):
        return list(db.db.companies.find({"user_id": self.user_id}, {"_id": 0}))

    def get_resumes_meta(self):
        meta = db.db.resumes_meta.find_one({"user_id": self.user_id})
        if meta and meta.get("default_id"):
            resume = db.db.resumes.find_one({"id": meta["default_id"], "user_id": self.user_id})
            if resume:
                return {"default_resume_path": resume["path"]}
        return {"default_resume_path": ""}
