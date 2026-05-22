"""
Settings API — grouped sub-routes for each settings category.
All endpoints read/write to the user_settings MongoDB collection,
with AES-256 encryption for sensitive fields.
Falls back gracefully if MongoDB is not available.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from auth.auth_handler import get_current_user_id
from repositories.user_repo import SettingsRepository
from security.encryption import encrypt, decrypt
from core.database import db

router = APIRouter(prefix="/settings", tags=["settings"])

# ── Helpers ──────────────────────────────────────────────────────────
def _get(user_id: str) -> dict:
    doc = SettingsRepository.get_settings(user_id)
    return doc or {}

def _save(user_id: str, data: dict):
    data["updated_at"] = datetime.utcnow()
    SettingsRepository.update_settings(user_id, data)

def _enc(val: Optional[str]) -> Optional[str]:
    return encrypt(val) if val else val

def _dec(val: Optional[str]) -> Optional[str]:
    return decrypt(val) if val else val

# ── LinkedIn ─────────────────────────────────────────────────────────
class LinkedInSettings(BaseModel):
    linkedin_email:     Optional[str] = ""
    linkedin_password:  Optional[str] = ""
    linkedin_phone:     Optional[str] = ""
    follow_companies:   bool = True
    connect_with_hr:    bool = False

@router.get("/linkedin", response_model=LinkedInSettings)
def get_linkedin(user_id: str = Depends(get_current_user_id)):
    s = _get(user_id)
    return LinkedInSettings(
        linkedin_email=s.get("linkedin_email", ""),
        linkedin_password=_dec(s.get("linkedin_password", "")),
        linkedin_phone=s.get("linkedin_phone", ""),
        follow_companies=s.get("follow_companies", True),
        connect_with_hr=s.get("connect_with_hr", False),
    )

@router.put("/linkedin")
def save_linkedin(payload: LinkedInSettings, user_id: str = Depends(get_current_user_id)):
    data = payload.dict()
    if data.get("linkedin_password"):
        data["linkedin_password"] = _enc(data["linkedin_password"])
    _save(user_id, data)
    return {"ok": True}


# ── AI / LLM ─────────────────────────────────────────────────────────
class AISettings(BaseModel):
    llm_model:          Optional[str] = "gemini-1.5-flash"
    llm_api_key:        Optional[str] = ""
    ollama_url:         Optional[str] = "http://localhost:11434"
    resume_summarizer:  bool = True
    cover_letter:       bool = False
    job_match_score:    bool = True
    min_match_score:    int  = 70

@router.get("/ai", response_model=AISettings)
def get_ai(user_id: str = Depends(get_current_user_id)):
    s = _get(user_id)
    return AISettings(
        llm_model=s.get("llm_model", "gemini-1.5-flash"),
        llm_api_key=_dec(s.get("llm_api_key", "")),
        ollama_url=s.get("ollama_url", "http://localhost:11434"),
        resume_summarizer=s.get("resume_summarizer", True),
        cover_letter=s.get("cover_letter", False),
        job_match_score=s.get("job_match_score", True),
        min_match_score=s.get("min_match_score", 70),
    )

@router.put("/ai")
def save_ai(payload: AISettings, user_id: str = Depends(get_current_user_id)):
    data = payload.dict()
    if data.get("llm_api_key"):
        data["llm_api_key"] = _enc(data["llm_api_key"])
    _save(user_id, data)
    return {"ok": True}


# ── API Keys ──────────────────────────────────────────────────────────
class ApiKeysSettings(BaseModel):
    openai_key:      Optional[str] = ""
    anthropic_key:   Optional[str] = ""
    gemini_key:      Optional[str] = ""
    adzuna_app_id:   Optional[str] = ""
    adzuna_app_key:  Optional[str] = ""
    jsearch_key:     Optional[str] = ""

ENCRYPTED_KEY_FIELDS = [
    "openai_key", "anthropic_key", "gemini_key",
    "adzuna_app_id", "adzuna_app_key", "jsearch_key",
]

@router.get("/apikeys", response_model=ApiKeysSettings)
def get_apikeys(user_id: str = Depends(get_current_user_id)):
    s = _get(user_id)
    return ApiKeysSettings(
        **{k: _dec(s.get(k, "")) for k in ApiKeysSettings.__fields__}
    )

@router.put("/apikeys")
def save_apikeys(payload: ApiKeysSettings, user_id: str = Depends(get_current_user_id)):
    data = payload.dict()
    for field in ENCRYPTED_KEY_FIELDS:
        if data.get(field):
            data[field] = _enc(data[field])
    _save(user_id, data)
    return {"ok": True}


# ── Automation ────────────────────────────────────────────────────────
class AutomationSettings(BaseModel):
    apply_limit_daily:   int   = 50
    apply_delay_min:     int   = 3
    apply_delay_max:     int   = 8
    run_headless:        bool  = True
    auto_retry_failed:   bool  = True
    blacklist_companies: str   = ""
    easy_apply_only:     bool  = True
    skip_promoted:       bool  = False
    salary_min:          int   = 0

@router.get("/automation", response_model=AutomationSettings)
def get_automation(user_id: str = Depends(get_current_user_id)):
    s = _get(user_id)
    return AutomationSettings(
        apply_limit_daily=s.get("apply_limit_daily", 50),
        apply_delay_min=s.get("apply_delay_min", 3),
        apply_delay_max=s.get("apply_delay_max", 8),
        run_headless=s.get("run_headless", True),
        auto_retry_failed=s.get("auto_retry_failed", True),
        blacklist_companies=s.get("blacklist_companies", ""),
        easy_apply_only=s.get("easy_apply_only", True),
        skip_promoted=s.get("skip_promoted", False),
        salary_min=s.get("salary_min", 0),
    )

@router.put("/automation")
def save_automation(payload: AutomationSettings, user_id: str = Depends(get_current_user_id)):
    _save(user_id, payload.dict())
    return {"ok": True}


# ── Legacy catch-all GET/POST (used by ConfigEditor) ─────────────────
from schemas.user import UserSettingsBase, UserSettingsResponse

@router.get("", response_model=UserSettingsBase)
def get_settings_legacy(user_id: str = Depends(get_current_user_id)):
    s = _get(user_id)
    for field in ["linkedin_pass", "openai_api_key", "gemini_api_key", "anthropic_api_key",
                  "groq_api_key", "deepseek_api_key"]:
        if s.get(field):
            s[field] = _dec(s[field])
    return UserSettingsBase(**{k: v for k, v in s.items() if k in UserSettingsBase.__fields__})

@router.post("")
def update_settings_legacy(payload: UserSettingsBase, user_id: str = Depends(get_current_user_id)):
    data = payload.dict(exclude_unset=True)
    for field in ["linkedin_pass", "openai_api_key", "gemini_api_key", "anthropic_api_key",
                  "groq_api_key", "deepseek_api_key"]:
        if data.get(field):
            data[field] = _enc(data[field])
    _save(user_id, data)
    return {"ok": True}
