# Backward-compatible shim — real code is in server/config/config_manager.py
from config.config_manager import *  # noqa: F401,F403
from config.config_manager import get_all_configs, read_config, update_all_configs, write_config
