from pydantic import BaseModel
from typing import List, Optional

class SearchRuleBase(BaseModel):
    search_terms: List[str] = ["Software Engineer"]
    search_location: str = "United States"
    job_type: List[str] = ["Full-time"]
    experience_level: List[str] = ["Entry level", "Associate"]
    on_site: List[str] = ["Remote"]
    date_posted: List[str] = ["Past 24 hours"]
    easy_apply_only: bool = True
    apply_mode: str = "standard"
    per_term_resume: bool = False

class SearchRuleResponse(SearchRuleBase):
    user_id: str
