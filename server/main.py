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
from db import healthcheck as mongo_healthcheck
from store import (
    list_posts as store_list_posts,
    list_applied as store_list_applied,
    list_manual_apply as store_list_manual_apply,
    dismiss_manual_apply as store_dismiss_manual_apply,
    bulk_dismiss_manual_apply as store_bulk_dismiss_manual_apply,
    mark_manual_apply_done as store_mark_manual_apply_done,
    applied_status_map as store_applied_status_map,
    list_companies as store_list_companies,
    replace_companies as store_replace_companies,
    read_search_rules as store_read_search_rules,
    write_search_rules as store_write_search_rules,
    clear_apply_log as store_clear_apply_log,
)

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
    s = store_read_search_rules()
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
    # Wipe the legacy chip filters that aren't surfaced in the typed editor.
    # If we don't clear them, runAiBot.apply_filters() keeps trying to click
    # stale Product Manager / Company chips while searching for DevOps roles,
    # producing "Click Failed! Didn't find 'X'" noise in the log and no effect.
    # Users who want chip filters can still set them via the Raw Config tab.
    for legacy in ("job_titles", "companies", "location", "industry",
                   "job_function", "benefits", "commitments"):
        payload[legacy] = []
    store_write_search_rules(payload)
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
    return {"target_companies": store_list_companies()}


@app.post("/api/companies")
def post_companies(payload: CompaniesPayload, user: str = Depends(require_admin)):
    store_replace_companies([c.dict() for c in payload.target_companies])
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


class KeywordScanBody(BaseModel):
    keywords: list[str]
    dry_run: bool = False


@app.post("/api/feed-scan/start-keyword")
def feed_start_keyword(body: KeywordScanBody, user: str = Depends(require_admin)):
    """
    Kick off a LinkedIn content-search scrape for the given free-text keywords
    (e.g. ["hiring", "we're hiring devops engineer"]). Each keyword is a
    separate LinkedIn search; hits are stored alongside the company-feed hits
    with Source="linkedin_keyword:<kw>". The "feed" slot is shared with the
    company-feed scan — only one runs at a time.
    """
    cleaned = [k.strip() for k in (body.keywords or []) if k and k.strip()]
    if not cleaned:
        return {"ok": False, "error": "no keywords"}
    return start_feed_scan(dry_run=body.dry_run, keywords=cleaned)


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
    """Read applied / failed jobs. status=applied|failed|all (default all). Mongo first, CSV fallback."""
    return {"jobs": store_list_applied(limit=limit, status=status)}


@app.get("/api/applied-jobs/submitted")
def applied_jobs_submitted(limit: int = 500, user: str = Depends(require_admin)):
    """
    Subset of applied jobs that were ACTUALLY submitted — i.e. the row has a
    real Date Applied timestamp (Easy Apply success), or the user marked it
    manually applied. This is what the "Applied Logs" dashboard reads.
    """
    rows = store_list_applied(limit=10_000, status="applied")
    out = []
    for r in rows:
        date_applied = r.get("Date Applied") or r.get("date_applied") or ""
        has_real_date = bool(date_applied) and str(date_applied).strip().lower() != "pending"
        if has_real_date or r.get("manually_applied"):
            out.append(r)
        if len(out) >= limit:
            break
    return {"jobs": out, "count": len(out)}


@app.post("/api/applied-jobs/clear")
def clear_applied_jobs(keep_backup: bool = True, user: str = Depends(require_admin)):
    """
    Nuke the apply history. Backs up both CSVs to <name>.bak.<utc>.csv first
    (skip with keep_backup=false), then truncates them, drops Mongo
    applied_jobs, and resets the manual-apply sidecar.
    """
    return store_clear_apply_log(keep_backup=keep_backup)


@app.get("/api/manual-apply")
def manual_apply(limit: int = 500, user: str = Depends(require_admin)):
    """
    Jobs the bot collected an external apply link for but couldn't Easy-Apply.
    You finish these by hand — the Manual Apply tab in the dashboard renders
    this. Results are sorted recent-first and exclude dismissed rows.
    """
    return {"jobs": store_list_manual_apply(limit=limit)}


class ManualDoneBody(BaseModel):
    done: bool = True


@app.post("/api/manual-apply/{job_id}/done")
def manual_apply_done(job_id: str, body: ManualDoneBody, user: str = Depends(require_admin)):
    """
    Mark (or un-mark) a Manual Apply row as "done by hand". This:
      - records the timestamp in the manual-apply sidecar,
      - sets `manually_applied=true` on the underlying applied_jobs Mongo doc,
      - promotes a "Pending" Date Applied to the current timestamp so the
        Apply Log shows the correct apply time + MANUAL badge.
    """
    return store_mark_manual_apply_done(job_id, done=body.done)


@app.delete("/api/manual-apply/{job_id}")
def manual_apply_delete(job_id: str, user: str = Depends(require_admin)):
    """
    Hide a job from the Manual Apply list (delete button on a row). The
    underlying applied_jobs row is left intact — only the Manual Apply view
    excludes it. Persists across browsers via the sidecar JSON.
    """
    return store_dismiss_manual_apply(job_id)


class BulkDeleteBody(BaseModel):
    job_ids: list[str]


@app.post("/api/manual-apply/bulk-delete")
def manual_apply_bulk_delete(body: BulkDeleteBody, user: str = Depends(require_admin)):
    """Hide a batch of Job IDs from Manual Apply in one call. The Apply Log
    keeps every underlying row — Manual Apply just filters them out."""
    return store_bulk_dismiss_manual_apply(body.job_ids)


@app.get("/api/hiring-posts")
def hiring_posts(role: Optional[str] = None, company: Optional[str] = None, limit: int = 200, user: str = Depends(require_admin)):
    return {"posts": store_list_posts(role=role, company=company, limit=limit)}


@app.get("/api/linkedin-posts")
def linkedin_posts(limit: int = 200, all: bool = False, user: str = Depends(require_admin)):
    """
    Hiring posts auto-filtered to ones matching the user's current search_terms,
    annotated with whether the bot has already applied to / failed on the
    underlying Job ID (extracted from Apply URL or Post URL when present).
    This is what the LinkedIn Posts tab in the dashboard reads.

    Set `all=true` to bypass the search_terms filter — useful for keyword
    scans like "hiring" that legitimately return posts outside the user's
    configured roles.
    """
    s = store_read_search_rules()
    terms = s.get("search_terms", []) or []
    if all or not terms:
        posts = store_list_posts(limit=limit)
    else:
        posts = store_list_posts(match_terms=terms, limit=limit)

    # Try to extract Job IDs from Apply URLs that look like LinkedIn /jobs/view/{id}
    # so we can mark which posts have already been applied to.
    import re as _re
    JOB_ID_RE = _re.compile(r"/jobs/view/(\d+)")
    candidate_ids = []
    for p in posts:
        for url in (p.get("Apply URL", ""), p.get("Post URL", "")):
            m = JOB_ID_RE.search(url or "")
            if m:
                candidate_ids.append(m.group(1))
                p["_job_id"] = m.group(1)
                break
    status_map = store_applied_status_map(candidate_ids)
    for p in posts:
        jid = p.get("_job_id")
        p["_applied_status"] = status_map.get(jid) if jid else None
    return {"posts": posts, "matched_terms": terms}


@app.get("/api/mongo/health")
def mongo_health(user: str = Depends(require_admin)):
    return mongo_healthcheck()


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
