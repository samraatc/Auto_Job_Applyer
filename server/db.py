# Backward-compatible shim — real code is in server/database/mongo_client.py
from database.mongo_client import *  # noqa: F401,F403
from database.mongo_client import get_db, healthcheck, is_enabled  # explicit
