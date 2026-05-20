"""
MongoDB client factory.

Reads MONGODB_URI (default empty — disables Mongo) and MONGODB_DB
(default `auto_job_applier`) from the environment. When the URI is set and
Atlas is reachable, repos in `server/store.py` dual-write to Mongo and
prefer Mongo on reads. When Mongo is unreachable, every repo silently
falls back to the file-based store so the bot keeps working.

Connection is lazy and cached, with a short serverSelectionTimeoutMS so the
first read after Atlas hiccups doesn't block the UI for 30 seconds.
"""
from __future__ import annotations

import os
import threading
from typing import Optional

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except ImportError:  # pragma: no cover — pip install in user's hands
    MongoClient = None  # type: ignore
    PyMongoError = Exception  # type: ignore

MONGODB_URI = os.environ.get("MONGODB_URI", "")
MONGODB_DB = os.environ.get("MONGODB_DB", "auto_job_applier")

_lock = threading.Lock()
_client: Optional["MongoClient"] = None
_db_handle = None
_last_failure_log: float = 0.0


def _now() -> float:
    import time
    return time.time()


def _log_failure(msg: str) -> None:
    """Throttle 'Mongo down' warnings so we don't spam stdout once per request."""
    global _last_failure_log
    now = _now()
    if now - _last_failure_log > 60:
        print(f"[db] {msg}")
        _last_failure_log = now


def is_enabled() -> bool:
    """Whether a Mongo URI was provided. Doesn't guarantee Atlas is reachable."""
    return bool(MONGODB_URI) and MongoClient is not None


def get_db():
    """
    Return a pymongo Database handle, or None if Mongo is disabled or
    unreachable. Cached after the first successful connection.
    """
    global _client, _db_handle
    if not is_enabled():
        return None
    if _db_handle is not None:
        return _db_handle

    with _lock:
        if _db_handle is not None:
            return _db_handle
        try:
            _client = MongoClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                socketTimeoutMS=5000,
                appname="auto_job_applier",
                retryWrites=True,
            )
            # Force a quick handshake so we fail fast.
            _client.admin.command("ping")
            _db_handle = _client[MONGODB_DB]
            _ensure_indexes(_db_handle)
            print(f"[db] connected to Mongo db={MONGODB_DB}")
            return _db_handle
        except PyMongoError as e:
            _log_failure(f"Mongo connect failed ({type(e).__name__}); falling back to files")
            _client = None
            _db_handle = None
            return None
        except Exception as e:
            _log_failure(f"Mongo init error: {e}; falling back to files")
            return None


def _ensure_indexes(db) -> None:
    """Create indexes that the repos rely on. Idempotent."""
    try:
        db.posts.create_index("post_url", unique=True, sparse=True, name="post_url_unique")
        db.posts.create_index("classified_at", name="classified_at")
        db.posts.create_index("matched_role", name="matched_role")
        db.applied_jobs.create_index("job_id", unique=True, sparse=True, name="job_id_unique")
        db.applied_jobs.create_index("date_applied", name="date_applied")
        db.applied_jobs.create_index("status", name="status")
        db.companies.create_index("linkedin_url", unique=True, sparse=True, name="company_url_unique")
        db.resumes.create_index("id", unique=True, name="resume_id_unique")
        db.search_rules.create_index("_id", name="_id_")
    except PyMongoError as e:
        _log_failure(f"index creation skipped: {e}")


def healthcheck() -> dict:
    """Surface to expose at /api/mongo/health (called by the dashboard)."""
    if not is_enabled():
        return {"enabled": False, "ok": False, "reason": "MONGODB_URI not set"}
    db = get_db()
    if db is None:
        return {"enabled": True, "ok": False, "reason": "Mongo unreachable"}
    try:
        db.command("ping")
        return {"enabled": True, "ok": True, "db": MONGODB_DB}
    except Exception as e:
        return {"enabled": True, "ok": False, "reason": str(e)}
