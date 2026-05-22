from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    auth_provider: str = "local" # local, google, etc.

class UserSettingsBase(BaseModel):
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    ai_model: Optional[str] = "gpt-4o-mini"
    
    linkedin_user: Optional[str] = None
    linkedin_pass: Optional[str] = None # Will be encrypted before storing
    
    proxy_url: Optional[str] = None
    automation_speed: float = 1.0
    captcha_solving_enabled: bool = False

class UserSettingsResponse(UserSettingsBase):
    user_id: str
    updated_at: datetime
