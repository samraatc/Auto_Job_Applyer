"""
User document model for MongoDB users collection.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class UserDocument:
    """Represents a user document in MongoDB."""
    username: str
    email: str
    password_hash: str
    auth_provider: str = "local"  # local | google
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    is_active: bool = True
