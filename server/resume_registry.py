# Backward-compatible shim — real code is in server/resumes/registry.py
from resumes.registry import *  # noqa: F401,F403
from resumes.registry import list_resumes, upload_resume, set_default, delete_resume
