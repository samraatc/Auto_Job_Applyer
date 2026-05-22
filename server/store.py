"""
Repository layer over MongoDB with file-system fallbacks.

Every function here tries Mongo first; if Mongo is unreachable (or
MONGODB_URI isn't set) it reads/writes the file that the rest of the codebase
already uses — `all excels/*.csv`, `all resumes/registry.json`,
`config/companies.py`, `config/search.py`. That guarantees `runAiBot.py`
still functions in a standalone, Mongo-less run.

Writes are dual: when Mongo is reachable we upsert into Mongo *and* append to
the existing file, so:
  - `feed_jobs.csv` keeps growing for offline analysis,
  - the Apply Log CSVs keep working,
  - Mongo holds the canonical, queryable copy.
"""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from typing import Any, Iterable, Optional

from db import get_db  # type: ignore

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXCEL_DIR = os.path.join(PROJECT_ROOT, "all excels")
FEED_CSV = os.path.join(EXCEL_DIR, "feed_jobs.csv")
APPLIED_CSV = os.path.join(EXCEL_DIR, "all_applied_applications_history.csv")
FAILED_CSV = os.path.join(EXCEL_DIR, "all_failed_applications_history.csv")
RESUMES_REGISTRY = os.path.join(PROJECT_ROOT, "all resumes", "registry.json")
MANUAL_STATE_FILE = os.path.join(EXCEL_DIR, "manual_apply_state.json")


# --------------------------------------------------------------------------- #
# Manual-apply sidecar state (works in both Mongo and CSV-only modes)         #
# Tracks dismissed Job IDs (delete-button) and manually-applied state         #
# (Done button) so behaviour persists across browsers.                        #
# --------------------------------------------------------------------------- #

def _load_manual_state() -> dict:
    if not os.path.exists(MANUAL_STATE_FILE):
        return {"dismissed": {}, "done": {}}
    try:
        with open(MANUAL_STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
        data.setdefault("dismissed", {})
        data.setdefault("done", {})
        return data
    except Exception:
        return {"dismissed": {}, "done": {}}


def _save_manual_state(data: dict) -> None:
    os.makedirs(EXCEL_DIR, exist_ok=True)
    with open(MANUAL_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# --------------------------------------------------------------------------- #
# Hiring posts (feed scraper output)                                          #
# --------------------------------------------------------------------------- #

FEED_FIELDS = [
    "Source", "Company", "Posted At", "Title", "Location",
    "Apply URL", "Post URL", "Confidence", "Classified At",
    "Matched Role", "Post Excerpt",
    "Author Name", "Author URL",
]


def _post_doc(row: dict) -> dict:
    """Normalise a CSV-shaped row into a Mongo doc with stable snake_case keys."""
    return {
        "source": row.get("Source") or row.get("source") or "linkedin_feed",
        "company": row.get("Company") or row.get("company") or "",
        "posted_at": row.get("Posted At") or row.get("posted_at") or "",
        "title": row.get("Title") or row.get("title") or "",
        "location": row.get("Location") or row.get("location") or "",
        "apply_url": row.get("Apply URL") or row.get("apply_url") or "",
        "post_url": row.get("Post URL") or row.get("post_url") or "",
        "confidence": float(row.get("Confidence") or row.get("confidence") or 0) or 0.0,
        "classified_at": row.get("Classified At") or row.get("classified_at") or datetime.utcnow().isoformat() + "Z",
        "matched_role": row.get("Matched Role") or row.get("matched_role") or "",
        "post_excerpt": row.get("Post Excerpt") or row.get("post_excerpt") or "",
        # Keyword-search hits carry the author so the LinkedIn Posts tab can
        # surface a "Contact" link straight to the poster's profile.
        "author_name": row.get("Author Name") or row.get("author_name") or "",
        "author_url": row.get("Author URL") or row.get("author_url") or "",
    }


def upsert_posts(rows: Iterable[dict]) -> int:
    """
    Insert/update a batch of post rows. Returns number processed.
    Always writes to CSV for compatibility; additionally upserts to Mongo when available.
    """
    rows = list(rows)
    if not rows:
        return 0

    # CSV append (existing behaviour)
    os.makedirs(EXCEL_DIR, exist_ok=True)
    write_header = not os.path.exists(FEED_CSV)
    with open(FEED_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FEED_FIELDS)
        if write_header:
            w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in FEED_FIELDS})

    db = get_db()
    if db is None:
        return len(rows)
    try:
        from pymongo import UpdateOne
        ops = []
        for r in rows:
            d = _post_doc(r)
            if not d["post_url"]:
                # No post URL means dedupe is unsafe; fall back to inserting unkeyed.
                db.posts.insert_one(d)
                continue
            ops.append(UpdateOne({"post_url": d["post_url"]}, {"$set": d}, upsert=True))
        if ops:
            db.posts.bulk_write(ops, ordered=False)
    except Exception as e:
        print(f"[store] posts upsert failed: {e}")
    return len(rows)


def list_posts(role: Optional[str] = None, company: Optional[str] = None,
               match_terms: Optional[list[str]] = None, limit: int = 200) -> list[dict]:
    """
    Read hiring posts. Mongo first, CSV fallback. `match_terms` filters to
    posts whose matched_role or title contains any of the given terms.
    """
    db = get_db()
    if db is not None:
        q: dict[str, Any] = {}
        if role:
            q["$or"] = [{"matched_role": {"$regex": role, "$options": "i"}},
                        {"title": {"$regex": role, "$options": "i"}}]
        if company:
            q["company"] = {"$regex": company, "$options": "i"}
        if match_terms:
            term_clauses = []
            for t in match_terms:
                term_clauses.append({"matched_role": {"$regex": t, "$options": "i"}})
                term_clauses.append({"title": {"$regex": t, "$options": "i"}})
                term_clauses.append({"post_excerpt": {"$regex": t, "$options": "i"}})
            q.setdefault("$or", []).extend(term_clauses)
        try:
            cursor = db.posts.find(q, {"_id": 0}).sort("classified_at", -1).limit(limit)
            return [_post_doc_to_api(d) for d in cursor]
        except Exception as e:
            print(f"[store] posts read fell back to CSV: {e}")

    # CSV fallback
    if not os.path.exists(FEED_CSV):
        return []
    with open(FEED_CSV, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    rows.sort(key=lambda r: r.get("Classified At", ""), reverse=True)
    if role:
        rl = role.lower()
        rows = [r for r in rows if rl in (r.get("Matched Role", "") + " " + r.get("Title", "")).lower()]
    if company:
        cl = company.lower()
        rows = [r for r in rows if cl in r.get("Company", "").lower()]
    if match_terms:
        terms_lc = [t.lower() for t in match_terms]
        def hit(r):
            blob = (r.get("Matched Role", "") + " " + r.get("Title", "") + " " + r.get("Post Excerpt", "")).lower()
            return any(t in blob for t in terms_lc)
        rows = [r for r in rows if hit(r)]
    return rows[:limit]


def _post_doc_to_api(d: dict) -> dict:
    """Mongo doc → API shape that matches the existing CSV column names the UI reads."""
    return {
        "Source": d.get("source", ""),
        "Company": d.get("company", ""),
        "Posted At": d.get("posted_at", ""),
        "Title": d.get("title", ""),
        "Location": d.get("location", ""),
        "Apply URL": d.get("apply_url", ""),
        "Post URL": d.get("post_url", ""),
        "Confidence": d.get("confidence", 0),
        "Classified At": d.get("classified_at", ""),
        "Matched Role": d.get("matched_role", ""),
        "Post Excerpt": d.get("post_excerpt", ""),
        "Author Name": d.get("author_name", ""),
        "Author URL": d.get("author_url", ""),
    }


# --------------------------------------------------------------------------- #
# Applied / failed jobs                                                       #
# --------------------------------------------------------------------------- #

APPLIED_FIELDS = ["Job ID", "Title", "Company", "Work Location", "Work Style",
                  "About Job", "Experience required", "Skills required",
                  "HR Name", "HR Link", "Resume", "Re-posted",
                  "Date Posted", "Date Applied", "Job Link",
                  "External Job link", "Questions Found", "Connect Request"]


def record_applied(entry: dict, status: str = "applied") -> None:
    """Add a row to the Mongo applied_jobs collection. Idempotent on Job ID.
    Sets `created_at` only on first insert so the recency sort on Manual Apply
    is stable across re-runs (re-applies don't bump the timestamp)."""
    db = get_db()
    if db is None:
        return
    try:
        now_iso = datetime.utcnow().isoformat() + "Z"
        doc = {k.lower().replace(" ", "_").replace("-", "_"): v for k, v in entry.items()}
        doc["job_id"] = str(entry.get("Job ID") or entry.get("job_id") or "")
        doc["title"] = entry.get("Title") or entry.get("title") or ""
        doc["company"] = entry.get("Company") or entry.get("company") or ""
        doc["status"] = status
        doc["date_applied"] = entry.get("Date Applied") or entry.get("date_applied") or now_iso
        doc["job_link"] = entry.get("Job Link") or entry.get("job_link") or ""
        doc["external_link"] = entry.get("External Job link") or ""
        if not doc["job_id"]:
            doc["created_at"] = now_iso
            db.applied_jobs.insert_one(doc)
            return
        db.applied_jobs.update_one(
            {"job_id": doc["job_id"]},
            {"$set": doc, "$setOnInsert": {"created_at": now_iso}},
            upsert=True,
        )
    except Exception as e:
        print(f"[store] applied write failed: {e}")


def list_applied(limit: int = 500, status: Optional[str] = None) -> list[dict]:
    """Read applied/failed history. Mongo first, falls back to CSVs.
    Always enriches rows with the manually_applied flag from the sidecar so
    the Apply Log can show a MANUAL badge whether or not Mongo is online."""
    state = _load_manual_state()
    done_map = state.get("done", {})

    def _enrich(rows: list[dict]) -> list[dict]:
        for r in rows:
            jid = _row_jid(r)
            if jid and jid in done_map and not r.get("manually_applied"):
                r["manually_applied"] = True
                r.setdefault("manually_applied_at", done_map[jid])
        return rows

    db = get_db()
    if db is not None:
        q: dict[str, Any] = {}
        if status and status != "all":
            q["status"] = status
        try:
            cursor = db.applied_jobs.find(q, {"_id": 0}).sort("date_applied", -1).limit(limit)
            out = []
            for d in cursor:
                d["_status"] = d.get("status", "applied")
                d.setdefault("Job ID", d.get("job_id", ""))
                d.setdefault("Title", d.get("title", ""))
                d.setdefault("Company", d.get("company", ""))
                d.setdefault("Date Applied", d.get("date_applied", ""))
                d.setdefault("Job Link", d.get("job_link", ""))
                out.append(d)
            return _enrich(out)
        except Exception as e:
            print(f"[store] applied read fell back to CSV: {e}")

    # CSV fallback (matches the original /api/applied-jobs behaviour)
    rows: list[dict] = []
    files: list[tuple[str, str]] = []
    if status in (None, "all", "applied"):
        files.append(("applied", APPLIED_CSV))
    if status in (None, "all", "failed"):
        files.append(("failed", FAILED_CSV))
    for tag, path in files:
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                r["_status"] = tag
                rows.append(r)
    rows.sort(key=lambda r: r.get("Date Applied", ""), reverse=True)
    return _enrich(rows[:limit])


def _row_jid(r: dict) -> str:
    return str(r.get("Job ID") or r.get("job_id") or "").strip()


def _csv_row_index(job_id: str) -> int:
    """Position in the applied CSV (0 = oldest), used as a fallback recency
    proxy when Mongo / created_at aren't available. Higher = more recent."""
    if not os.path.exists(APPLIED_CSV) or not job_id:
        return -1
    try:
        with open(APPLIED_CSV, "r", encoding="utf-8") as f:
            for i, row in enumerate(csv.DictReader(f)):
                if (row.get("Job ID") or "").strip() == job_id:
                    return i
    except Exception:
        pass
    return -1


def list_manual_apply(limit: int = 500) -> list[dict]:
    """
    Subset of applied jobs where the bot collected an EXTERNAL apply link
    rather than submitting via Easy Apply — i.e. the rows the user still
    has to click through and apply to themselves.

    Rows the user has explicitly dismissed (delete button) are excluded.
    Output is sorted recent-first.
    """
    state = _load_manual_state()
    dismissed = state.get("dismissed", {})
    done_map = state.get("done", {})

    rows = list_applied(limit=10_000, status="applied")
    out = []
    for r in rows:
        link = (r.get("external_link") or r.get("External Job link") or "").strip()
        if not link or link.lower() == "easy applied":
            continue
        jid = _row_jid(r)
        if jid and jid in dismissed:
            continue
        # Normalise to the keys the UI already understands.
        r.setdefault("External Job link", link)
        # Merge the per-row done state from the sidecar.
        r["manually_applied"] = bool(r.get("manually_applied")) or bool(jid and done_map.get(jid))
        if jid and done_map.get(jid) and not r.get("manually_applied_at"):
            r["manually_applied_at"] = done_map[jid]
        # Recency key — prefer Mongo's created_at, else fall back to CSV order.
        ts = r.get("created_at") or r.get("manually_applied_at") or r.get("Date Applied") or ""
        r["_recency_key"] = ts if ts and ts != "Pending" else ""
        if not r["_recency_key"] and jid:
            r["_recency_idx"] = _csv_row_index(jid)
        out.append(r)

    # Sort: rows with a real timestamp first (newest first), then by CSV
    # position (later = more recent). Stable across runs.
    out.sort(key=lambda r: (r.get("_recency_key") or "", r.get("_recency_idx", -1)), reverse=True)
    return out[:limit]


def dismiss_manual_apply(job_id: str) -> dict:
    """Mark a Job ID as 'don't show on Manual Apply' (delete button).
    Sidecar JSON is the source of truth so behaviour is identical with and
    without Mongo."""
    job_id = str(job_id or "").strip()
    state = _load_manual_state()
    state.setdefault("dismissed", {})[job_id] = datetime.utcnow().isoformat() + "Z"
    _save_manual_state(state)
    # Mirror to Mongo as a soft flag (doesn't affect the applied_jobs row itself).
    db = get_db()
    if db is not None:
        try:
            db.applied_jobs.update_one(
                {"job_id": job_id},
                {"$set": {"manual_apply_dismissed": True,
                          "manual_apply_dismissed_at": state["dismissed"][job_id]}},
            )
        except Exception as e:
            print(f"[store] dismiss mirror to Mongo failed: {e}")
    return {"ok": True, "job_id": job_id, "dismissed_at": state["dismissed"][job_id]}


def clear_apply_log(keep_backup: bool = True) -> dict:
    """
    Nuke the apply history: both CSVs, the Mongo `applied_jobs` collection,
    and the manual-apply sidecar. Each CSV is moved aside to
    `<name>.bak.<utc-iso>.csv` first so nothing is irreversibly lost
    (set keep_backup=False to skip the rename).

    Returns counts so the UI can show "Cleared N rows".
    """
    import shutil
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    backups: list[str] = []
    csv_counts: dict[str, int] = {}

    for label, path in (("applied", APPLIED_CSV), ("failed", FAILED_CSV)):
        if not os.path.exists(path):
            csv_counts[label] = 0
            continue
        # Count rows for the response
        try:
            with open(path, "r", encoding="utf-8") as f:
                csv_counts[label] = max(0, sum(1 for _ in f) - 1)
        except Exception:
            csv_counts[label] = 0
        # Back up
        if keep_backup:
            bak = f"{path}.bak.{timestamp}.csv"
            try:
                shutil.copy2(path, bak)
                backups.append(bak)
            except Exception as e:
                print(f"[store] backup of {path} failed: {e}")
        # Truncate (keep the file so subsequent appends still work)
        try:
            open(path, "w", encoding="utf-8").close()
        except Exception as e:
            print(f"[store] truncate of {path} failed: {e}")

    # Mongo wipe
    mongo_deleted = 0
    db = get_db()
    if db is not None:
        try:
            res = db.applied_jobs.delete_many({})
            mongo_deleted = res.deleted_count or 0
        except Exception as e:
            print(f"[store] applied_jobs delete_many failed: {e}")

    # Wipe manual-apply sidecar so old dismiss/done state doesn't bleed
    # into whatever the bot collects next.
    try:
        _save_manual_state({"dismissed": {}, "done": {}})
    except Exception as e:
        print(f"[store] manual_apply_state reset failed: {e}")

    return {
        "ok": True,
        "csv_rows": csv_counts,           # {applied: N, failed: M}
        "mongo_deleted": mongo_deleted,
        "backups": backups,               # absolute paths the user can restore from
        "cleared_at": datetime.utcnow().isoformat() + "Z",
    }


def bulk_dismiss_manual_apply(job_ids: list[str]) -> dict:
    """Mark a batch of Job IDs as dismissed in one go. Returns the count."""
    ids = [str(j).strip() for j in (job_ids or []) if str(j).strip()]
    if not ids:
        return {"ok": True, "count": 0, "job_ids": []}
    now_iso = datetime.utcnow().isoformat() + "Z"
    state = _load_manual_state()
    bucket = state.setdefault("dismissed", {})
    for jid in ids:
        bucket[jid] = now_iso
    _save_manual_state(state)
    db = get_db()
    if db is not None:
        try:
            db.applied_jobs.update_many(
                {"job_id": {"$in": ids}},
                {"$set": {"manual_apply_dismissed": True,
                          "manual_apply_dismissed_at": now_iso}},
            )
        except Exception as e:
            print(f"[store] bulk dismiss Mongo mirror failed: {e}")
    return {"ok": True, "count": len(ids), "job_ids": ids, "dismissed_at": now_iso}


def undismiss_manual_apply(job_id: str) -> dict:
    """Undo a delete — useful for accidental clicks. Not currently surfaced
    in the UI but kept for completeness."""
    state = _load_manual_state()
    state.get("dismissed", {}).pop(str(job_id), None)
    _save_manual_state(state)
    db = get_db()
    if db is not None:
        try:
            db.applied_jobs.update_one(
                {"job_id": str(job_id)},
                {"$unset": {"manual_apply_dismissed": "", "manual_apply_dismissed_at": ""}},
            )
        except Exception:
            pass
    return {"ok": True, "job_id": str(job_id)}


def mark_manual_apply_done(job_id: str, done: bool = True) -> dict:
    """Toggle Manual Apply 'Done' for a Job ID. Updates BOTH:
      - the sidecar JSON (so the Manual Apply list reflects it immediately,
        even without Mongo),
      - the applied_jobs Mongo doc with `manually_applied` + timestamp + a
        real `date_applied` when the bot's row was still 'Pending' (so the
        Apply Log shows the right time).
    """
    job_id = str(job_id or "").strip()
    now_iso = datetime.utcnow().isoformat() + "Z"
    state = _load_manual_state()
    done_map = state.setdefault("done", {})
    if done:
        done_map[job_id] = now_iso
    else:
        done_map.pop(job_id, None)
    _save_manual_state(state)

    db = get_db()
    if db is not None:
        try:
            update_set = {"manually_applied": bool(done)}
            if done:
                update_set["manually_applied_at"] = now_iso
                # Promote a Pending row to a real timestamp so Apply Log
                # sorts and renders correctly.
                existing = db.applied_jobs.find_one({"job_id": job_id}, {"date_applied": 1})
                if not existing or not existing.get("date_applied") or str(existing.get("date_applied")).strip().lower() == "pending":
                    update_set["date_applied"] = now_iso
            db.applied_jobs.update_one({"job_id": job_id}, {"$set": update_set}, upsert=False)
        except Exception as e:
            print(f"[store] mark_done Mongo update failed: {e}")
    return {"ok": True, "job_id": job_id, "manually_applied": bool(done),
            "manually_applied_at": done_map.get(job_id)}


def is_applied(job_id: str) -> bool:
    """Did the bot already apply (or fail) on this Job ID? Mongo only."""
    db = get_db()
    if db is None:
        return False
    try:
        return db.applied_jobs.count_documents({"job_id": str(job_id)}, limit=1) > 0
    except Exception:
        return False


def applied_status_map(job_ids: list[str]) -> dict[str, str]:
    """For an array of job IDs, return {id: status}. Used to badge LinkedIn-post rows."""
    db = get_db()
    if db is None:
        return {}
    try:
        cursor = db.applied_jobs.find({"job_id": {"$in": [str(j) for j in job_ids]}},
                                      {"_id": 0, "job_id": 1, "status": 1})
        return {d["job_id"]: d.get("status", "applied") for d in cursor}
    except Exception:
        return {}


# --------------------------------------------------------------------------- #
# Companies                                                                    #
# --------------------------------------------------------------------------- #

def list_companies() -> list[dict]:
    """Companies list. Mongo first, falls back to config/companies.py."""
    db = get_db()
    if db is not None:
        try:
            return [{"name": d.get("name"), "linkedin_url": d.get("linkedin_url"), "tags": d.get("tags", [])}
                    for d in db.companies.find({}, {"_id": 0}).sort("name", 1)]
        except Exception as e:
            print(f"[store] companies read fell back to file: {e}")
    from config_manager import read_config  # type: ignore
    return read_config("companies.py").get("target_companies", []) or []


def replace_companies(rows: list[dict]) -> None:
    """Replace the entire companies list (Mongo + config file)."""
    # File side (existing behaviour)
    from config_manager import write_config  # type: ignore
    write_config("companies.py", {"target_companies": rows})

    db = get_db()
    if db is None:
        return
    try:
        db.companies.delete_many({})
        if rows:
            db.companies.insert_many([{"name": r.get("name"), "linkedin_url": r.get("linkedin_url"),
                                       "tags": r.get("tags", [])} for r in rows])
    except Exception as e:
        print(f"[store] companies replace failed: {e}")


# --------------------------------------------------------------------------- #
# Resumes registry                                                             #
# --------------------------------------------------------------------------- #

def list_resumes_doc() -> dict:
    """Whole registry. Mongo first, falls back to registry.json."""
    db = get_db()
    if db is not None:
        try:
            resumes = list(db.resumes.find({}, {"_id": 0}).sort("uploaded_at", 1))
            meta = db.resumes_meta.find_one({"_id": "default"}, {"_id": 0}) or {}
            return {"resumes": resumes, "default_id": meta.get("default_id")}
        except Exception as e:
            print(f"[store] resumes read fell back to file: {e}")
    if not os.path.exists(RESUMES_REGISTRY):
        return {"resumes": [], "default_id": None}
    with open(RESUMES_REGISTRY, "r", encoding="utf-8") as f:
        return json.load(f)


def write_resumes_doc(data: dict) -> None:
    """Persist registry. Always writes JSON; also mirrors into Mongo if available."""
    os.makedirs(os.path.dirname(RESUMES_REGISTRY), exist_ok=True)
    with open(RESUMES_REGISTRY, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    db = get_db()
    if db is None:
        return
    try:
        db.resumes.delete_many({})
        if data.get("resumes"):
            db.resumes.insert_many(data["resumes"])
        db.resumes_meta.update_one({"_id": "default"}, {"$set": {"default_id": data.get("default_id")}}, upsert=True)
    except Exception as e:
        print(f"[store] resumes write failed: {e}")


# --------------------------------------------------------------------------- #
# Search rules                                                                 #
# --------------------------------------------------------------------------- #

def read_search_rules() -> dict:
    """Current search rules. Mongo first, falls back to config/search.py."""
    db = get_db()
    if db is not None:
        try:
            doc = db.search_rules.find_one({"_id": "current"}, {"_id": 0})
            if doc:
                return doc
        except Exception as e:
            print(f"[store] search rules read fell back to file: {e}")
    from config_manager import read_config  # type: ignore
    return read_config("search.py") or {}


def write_search_rules(payload: dict) -> None:
    """Persist search rules to config/search.py and (if available) Mongo."""
    from config_manager import write_config  # type: ignore
    write_config("search.py", payload)

    db = get_db()
    if db is None:
        return
    try:
        db.search_rules.update_one({"_id": "current"}, {"$set": payload}, upsert=True)
    except Exception as e:
        print(f"[store] search rules write failed: {e}")
