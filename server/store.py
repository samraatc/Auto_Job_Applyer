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


# --------------------------------------------------------------------------- #
# Hiring posts (feed scraper output)                                          #
# --------------------------------------------------------------------------- #

FEED_FIELDS = [
    "Source", "Company", "Posted At", "Title", "Location",
    "Apply URL", "Post URL", "Confidence", "Classified At",
    "Matched Role", "Post Excerpt",
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
    """Add a row to the Mongo applied_jobs collection. Idempotent on Job ID."""
    db = get_db()
    if db is None:
        return
    try:
        doc = {k.lower().replace(" ", "_").replace("-", "_"): v for k, v in entry.items()}
        doc["job_id"] = str(entry.get("Job ID") or entry.get("job_id") or "")
        doc["title"] = entry.get("Title") or entry.get("title") or ""
        doc["company"] = entry.get("Company") or entry.get("company") or ""
        doc["status"] = status
        doc["date_applied"] = entry.get("Date Applied") or entry.get("date_applied") or datetime.utcnow().isoformat()
        doc["job_link"] = entry.get("Job Link") or entry.get("job_link") or ""
        doc["external_link"] = entry.get("External Job link") or ""
        if not doc["job_id"]:
            db.applied_jobs.insert_one(doc)
            return
        db.applied_jobs.update_one(
            {"job_id": doc["job_id"]},
            {"$set": doc},
            upsert=True,
        )
    except Exception as e:
        print(f"[store] applied write failed: {e}")


def list_applied(limit: int = 500, status: Optional[str] = None) -> list[dict]:
    """Read applied/failed history. Mongo first, falls back to CSVs."""
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
            return out
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
    return rows[:limit]


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
