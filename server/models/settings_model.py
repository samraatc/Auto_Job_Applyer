"""
User settings document model for MongoDB user_settings collection.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class UserSettingsDocument:
    """Represents a user_settings document in MongoDB."""
    user_id: str
    # LinkedIn
    linkedin_email: str = ""
    linkedin_password: str = ""   # AES-256 encrypted
    linkedin_phone: str = ""
    follow_companies: bool = True
    connect_with_hr: bool = False
    # AI
    llm_model: str = "gemini-1.5-flash"
    llm_api_key: str = ""          # AES-256 encrypted
    ollama_url: str = "http://localhost:11434"
    resume_summarizer: bool = True
    cover_letter: bool = False
    job_match_score: bool = True
    min_match_score: int = 70
    # API Keys (all encrypted)
    openai_key: str = ""
    anthropic_key: str = ""
    gemini_key: str = ""
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    jsearch_key: str = ""
    # Automation
    apply_limit_daily: int = 50
    apply_delay_min: int = 3
    apply_delay_max: int = 8
    run_headless: bool = True
    auto_retry_failed: bool = True
    blacklist_companies: str = ""
    easy_apply_only: bool = True
    skip_promoted: bool = False
    salary_min: int = 0
    updated_at: Optional[datetime] = None
