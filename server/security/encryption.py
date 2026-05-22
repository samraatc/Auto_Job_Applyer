from cryptography.fernet import Fernet
from core.config import settings
import base64
import hashlib

def _get_fernet() -> Fernet:
    # Ensure key is 32 url-safe base64-encoded bytes
    key_bytes = settings.encryption_key.encode('utf-8')
    if len(key_bytes) != 32:
        # Hash to make it exactly 32 bytes
        key_bytes = hashlib.sha256(key_bytes).digest()
    b64_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(b64_key)

def encrypt(data: str) -> str:
    if not data:
        return ""
    f = _get_fernet()
    return f.encrypt(data.encode('utf-8')).decode('utf-8')

def decrypt(data: str) -> str:
    if not data:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(data.encode('utf-8')).decode('utf-8')
    except Exception:
        # If decryption fails (e.g. wrong key, unencrypted data), return raw data
        # Be careful in production, but for migration it's useful
        return data
