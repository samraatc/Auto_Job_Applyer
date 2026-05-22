from core.database import db
from schemas.search_rules import SearchRuleBase

class SearchRuleRepository:
    @staticmethod
    def get_rules(user_id: str):
        if db.get_db() is None:
            return None
        return db.db.search_rules.find_one({"user_id": user_id})

    @staticmethod
    def update_rules(user_id: str, rules_in: SearchRuleBase):
        if db.get_db() is None:
            return None
        data = rules_in.dict()
        db.db.search_rules.update_one(
            {"user_id": user_id},
            {"$set": data},
            upsert=True
        )
        return SearchRuleRepository.get_rules(user_id)
