from pymongo import MongoClient
from pymongo.errors import PyMongoError
from core.config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: MongoClient = None
    db = None

    @classmethod
    def connect(cls):
        if not settings.mongodb_uri:
            logger.warning("MONGODB_URI not set. Running in degraded mode (not supported for Multi-User).")
            return
        try:
            cls.client = MongoClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                socketTimeoutMS=5000,
                appname="auto_job_applier",
                retryWrites=True,
            )
            cls.client.admin.command("ping")
            cls.db = cls.client[settings.mongodb_db]
            cls._ensure_indexes(cls.db)
            logger.info(f"Connected to MongoDB: {settings.mongodb_db}")
        except PyMongoError as e:
            logger.error(f"MongoDB connection failed: {e}")
            cls.client = None
            cls.db = None

    @classmethod
    def get_db(cls):
        if cls.db is None:
            cls.connect()
        return cls.db

    @classmethod
    def _ensure_indexes(cls, db):
        try:
            db.users.create_index("email", unique=True)
            db.user_settings.create_index("user_id", unique=True)
            db.search_rules.create_index("user_id", unique=True)
            
            # Old indexes for app
            db.posts.create_index("post_url", unique=True, sparse=True)
            db.applied_jobs.create_index("job_id", unique=True, sparse=True)
            db.companies.create_index("linkedin_url", unique=True, sparse=True)
            db.resumes.create_index("id", unique=True)
        except PyMongoError as e:
            logger.warning(f"Index creation failed: {e}")

db = Database()
