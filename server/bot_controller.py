# Backward-compatible shim — real code is in server/bot/controller.py
from bot.controller import *  # noqa: F401,F403
from bot.controller import (
    start_bot, stop_bot, get_status, log_generator,
    start_feed_scan, stop_feed_scan, feed_status, feed_log_generator,
    start_discovery, discovery_status, discover_log_generator,
)
