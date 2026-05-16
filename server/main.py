import os
import sys

# Allow bare imports (config_manager, auth, …) whether launched as
# `uvicorn server.main:app` from the project root or directly from server/.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Auto-load .env from the project root so that ADMIN_USER, ADMIN_PASS,
# AJA_HTTPS, LINKEDIN_USER/PASS, LLM_* etc. are available before we import
# `auth` (which seeds itself from env on first boot) or `config.secrets`
# (which reads the LLM/LinkedIn credentials at import time).
# Falls back gracefully if python-dotenv is not installed.
try:
    from dotenv import load_dotenv
    _ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv(_ENV_PATH, override=False)
except ImportError:
    pass

from fastapi import FastAPI, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Literal, Optional
import csv

from config_manager import get_all_configs, read_config, update_all_configs, write_config
from bot_controller import (
    start_bot, stop_bot, get_status, log_generator,
    start_feed_scan, stop_feed_scan, feed_status, feed_log_generator,
    start_discovery, discovery_status, discover_log_generator,
)
from auth import (
    LoginPayload, verify_credentials, create_token, set_session_cookie,
    clear_session_cookie, require_admin, change_password,
)
from resume_registry import list_resumes, upload_resume, set_default, delete_resume

app = FastAPI(title="AI Applier Admin")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------- Auth -----------------------

@app.post("/api/auth/login")
def login(payload: LoginPayload, response: Response):
    if not verify_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token()
    set_session_cookie(response, token)
    return {"username": payload.username}


@app.post("/api/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: str = Depends(require_admin)):
    return {"username": user}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@app.post("/api/auth/change-password")
def change_pw(payload: PasswordChange, user: str = Depends(require_admin)):
    change_password(payload.current_password, payload.new_password)
    return {"ok": True}


# ----------------------- Config (legacy editor) -----------------------

@app.get("/api/config")
def read_configuration(user: str = Depends(require_admin)):
    return get_all_configs()


@app.post("/api/config")
async def save_configuration(request: Request, user: str = Depends(require_admin)):
    payload = await request.json()
    try:
        update_all_configs(payload)
        return {"message": "Configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----------------------- Search rules (typed) -----------------------

class SearchRules(BaseModel):
    search_terms: list[str]
    search_location: str
    job_type: list[str]
    experience_level: list[str]
    on_site: list[str]
    date_posted: str
    easy_apply_only: bool
    apply_mode: Literal["easy", "external", "both"] = "both"
    # {search_term: resume_id}. Resolved to {term: path} when written to search.py.
    per_term_resume: dict[str, str] = {}


@app.get("/api/search-rules", response_model=SearchRules)
def get_search_rules(user: str = Depends(require_admin)):
    s = read_config("search.py")
    # search.py stores {term: path}; translate back to {term: resume_id} for the UI.
    registry = list_resumes()
    path_to_id = {r["path"]: r["id"] for r in registry["resumes"]}
    stored = s.get("per_term_resume", {}) or {}
    per_term = {term: path_to_id.get(path, "") for term, path in stored.items() if path_to_id.get(path)}
    return SearchRules(
        search_terms=s.get("search_terms", []),
        search_location=s.get("search_location", ""),
        job_type=s.get("job_type", []),
        experience_level=s.get("experience_level", []),
        on_site=s.get("on_site", []),
        date_posted=s.get("date_posted", ""),
        easy_apply_only=s.get("easy_apply_only", False),
        apply_mode=s.get("apply_mode", "both"),
        per_term_resume=per_term,
    )


@app.post("/api/search-rules")
def post_search_rules(rules: SearchRules, user: str = Depends(require_admin)):
    payload = rules.dict()
    registry = list_resumes()
    id_to_path = {r["id"]: r["path"] for r in registry["resumes"]}
    payload["per_term_resume"] = {
        term: id_to_path[rid] for term, rid in payload["per_term_resume"].items() if rid and rid in id_to_path
    }
    write_config("search.py", payload)
    return {"ok": True}


# ----------------------- Resumes -----------------------

@app.get("/api/resumes")
def get_resumes(user: str = Depends(require_admin)):
    return list_resumes()


@app.post("/api/resumes")
async def post_resume(
    file: UploadFile = File(...),
    label: str = Form(""),
    tags: str = Form(""),
    make_default: bool = Form(False),
    user: str = Depends(require_admin),
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    entry = await upload_resume(file, label, tag_list, make_default)
    return entry


@app.patch("/api/resumes/{resume_id}/default")
def patch_default(resume_id: str, user: str = Depends(require_admin)):
    return set_default(resume_id)


@app.delete("/api/resumes/{resume_id}")
def del_resume(resume_id: str, user: str = Depends(require_admin)):
    return delete_resume(resume_id)


# ----------------------- Companies -----------------------

class Company(BaseModel):
    name: str
    linkedin_url: str
    tags: list[str] = []


class CompaniesPayload(BaseModel):
    target_companies: list[Company]


@app.get("/api/companies")
def get_companies(user: str = Depends(require_admin)):
    c = read_config("companies.py")
    return {"target_companies": c.get("target_companies", [])}


@app.post("/api/companies")
def post_companies(payload: CompaniesPayload, user: str = Depends(require_admin)):
    write_config("companies.py", {"target_companies": [c.dict() for c in payload.target_companies]})
    return {"ok": True}


@app.post("/api/companies/discover")
def trigger_discovery(user: str = Depends(require_admin)):
    return start_discovery()


@app.get("/api/companies/discover/status")
def discovery_state(user: str = Depends(require_admin)):
    return discovery_status()


@app.get("/api/companies/discover/logs")
async def discovery_logs(user: str = Depends(require_admin)):
    return StreamingResponse(discover_log_generator(), media_type="text/event-stream")


# ----------------------- Feed scan / hiring posts -----------------------

@app.post("/api/feed-scan/start")
def feed_start(dry_run: bool = False, user: str = Depends(require_admin)):
    return start_feed_scan(dry_run=dry_run)


@app.post("/api/feed-scan/stop")
def feed_stop(user: str = Depends(require_admin)):
    return stop_feed_scan()


@app.get("/api/feed-scan/status")
def feed_state(user: str = Depends(require_admin)):
    return feed_status()


@app.get("/api/feed-scan/logs")
async def feed_logs(user: str = Depends(require_admin)):
    return StreamingResponse(feed_log_generator(), media_type="text/event-stream")


@app.get("/api/applied-jobs")
def applied_jobs(limit: int = 500, status: Optional[str] = None, user: str = Depends(require_admin)):
    """Read the bot's applied / failed CSVs. status=applied|failed|all (default all)."""
    base = os.path.join(os.path.dirname(__file__), "..", "all excels")
    files = []
    if status in (None, "all", "applied"):
        files.append(("applied", os.path.join(base, "all_applied_applications_history.csv")))
    if status in (None, "all", "failed"):
        files.append(("failed", os.path.join(base, "all_failed_applications_history.csv")))
    rows = []
    for tag, path in files:
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                r["_status"] = tag
                rows.append(r)
    rows.sort(key=lambda r: r.get("Date Applied", ""), reverse=True)
    return {"jobs": rows[:limit]}


@app.get("/api/hiring-posts")
def hiring_posts(role: Optional[str] = None, company: Optional[str] = None, limit: int = 200, user: str = Depends(require_admin)):
    csv_path = os.path.join(os.path.dirname(__file__), "..", "all excels", "feed_jobs.csv")
    if not os.path.exists(csv_path):
        return {"posts": []}
    with open(csv_path, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if role:
        rl = role.lower()
        rows = [r for r in rows if rl in (r.get("Matched Role", "") + " " + r.get("Title", "")).lower()]
    if company:
        cl = company.lower()
        rows = [r for r in rows if cl in r.get("Company", "").lower()]
    rows.sort(key=lambda r: r.get("Classified At", ""), reverse=True)
    return {"posts": rows[:limit]}


# ----------------------- Bot controls -----------------------

@app.post("/api/bot/start")
def start_bot_endpoint(user: str = Depends(require_admin)):
    return start_bot()


@app.post("/api/bot/stop")
def stop_bot_endpoint(user: str = Depends(require_admin)):
    return stop_bot()


@app.get("/api/bot/status")
def status_endpoint():
    # Public — used for the unauthenticated landing/login screen badge if any.
    return get_status()


@app.get("/api/bot/logs")
async def logs_endpoint(user: str = Depends(require_admin)):
    return StreamingResponse(log_generator(), media_type="text/event-stream")


# Serve the frontend
frontend_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
