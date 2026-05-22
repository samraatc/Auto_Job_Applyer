import os

try:
    from pydantic_settings import BaseSettings
    class Settings(BaseSettings):
        mongodb_uri: str = os.environ.get("MONGODB_URI", "")
        mongodb_db: str = os.environ.get("MONGODB_DB", "auto_job_applier")
        secret_key: str = os.environ.get("SECRET_KEY", "your-super-secret-key-change-in-production")
        algorithm: str = "HS256"
        access_token_expire_minutes: int = 60 * 12 # 12 hours
        encryption_key: str = os.environ.get("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef") # 32 bytes for Fernet

        class Config:
            env_file = ".env"
except ImportError:
    # Safe fallback if pydantic-settings package is not installed in environment
    try:
        from dotenv import load_dotenv
        load_dotenv(override=False)
    except ImportError:
        pass

    class Settings:
        mongodb_uri: str = os.environ.get("MONGODB_URI", "")
        mongodb_db: str = os.environ.get("MONGODB_DB", "auto_job_applier")
        secret_key: str = os.environ.get("SECRET_KEY", "your-super-secret-key-change-in-production")
        algorithm: str = "HS256"
        access_token_expire_minutes: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 12))
        encryption_key: str = os.environ.get("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef")

settings = Settings()
