"""
One-shot, idempotent migration that imports existing CSV/JSON/config-py data
into MongoDB. Safe to re-run — every collection write is upsert-on-key.

Usage:
    python -m server.migrate_to_mongo            # full migration
    python -m server.migrate_to_mongo --dry-run  # just print what it would do

Requires MONGODB_URI to be set (via .env or shell). Exits non-zero if Mongo
isn't reachable so you notice.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import datetime

# Make project imports work whether run from project root or server/
THIS = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(THIS, ".."))
sys.path.insert(0, THIS)
sys.path.insert(0, PROJECT_ROOT)

# Load .env up-front so MONGODB_URI is visible
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=False)
except ImportError:
    pass

from db import get_db, is_enabled, MONGODB_DB  # type: ignore
from store import (  # type: ignore
    FEED_CSV, APPLIED_CSV, FAILED_CSV, RESUMES_REGISTRY, _post_doc,
)


def _read_csv(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def migrate_posts(db, dry: bool) -> int:
    rows = _read_csv(FEED_CSV)
    print(f"  posts: {len(rows)} rows in {os.path.basename(FEED_CSV)}")
    if dry or not rows:
        return len(rows)
    from pymongo import UpdateOne
    ops = []
    for r in rows:
        d = _post_doc(r)
        if not d["post_url"]:
            continue
        ops.append(UpdateOne({"post_url": d["post_url"]}, {"$set": d}, upsert=True))
    if ops:
        res = db.posts.bulk_write(ops, ordered=False)
        print(f"    upserted: {res.upserted_count}, modified: {res.modified_count}")
    return len(rows)


def migrate_applied(db, dry: bool) -> int:
    total = 0
    for label, path in (("applied", APPLIED_CSV), ("failed", FAILED_CSV)):
        rows = _read_csv(path)
        print(f"  {label}: {len(rows)} rows in {os.path.basename(path)}")
        total += len(rows)
        if dry or not rows:
            continue
        from pymongo import UpdateOne
        ops = []
        for r in rows:
            job_id = (r.get("Job ID") or "").strip()
            doc = {
                "job_id": job_id,
                "title": r.get("Title", ""),
                "company": r.get("Company", ""),
                "work_location": r.get("Work Location", ""),
                "work_style": r.get("Work Style", ""),
                "about_job": r.get("About Job", ""),
                "experience_required": r.get("Experience required", ""),
                "skills_required": r.get("Skills required", ""),
                "hr_name": r.get("HR Name", ""),
                "hr_link": r.get("HR Link", ""),
                "resume": r.get("Resume", ""),
                "reposted": r.get("Re-posted", ""),
                "date_posted": r.get("Date Posted", ""),
                "date_applied": r.get("Date Applied", ""),
                "job_link": r.get("Job Link", ""),
                "external_link": r.get("External Job link", ""),
                "questions_found": r.get("Questions Found", ""),
                "connect_request": r.get("Connect Request", ""),
                "status": label,
                # Preserve old API keys for backwards compatibility with the UI
                "Job ID": job_id, "Title": r.get("Title", ""), "Company": r.get("Company", ""),
                "Date Applied": r.get("Date Applied", ""), "Job Link": r.get("Job Link", ""),
            }
            if not job_id:
                db.applied_jobs.insert_one(doc)
                continue
            ops.append(UpdateOne({"job_id": job_id}, {"$set": doc}, upsert=True))
        if ops:
            res = db.applied_jobs.bulk_write(ops, ordered=False)
            print(f"    upserted: {res.upserted_count}, modified: {res.modified_count}")
    return total


def migrate_companies(db, dry: bool) -> int:
    from config_manager import read_config  # type: ignore
    rows = read_config("companies.py").get("target_companies", []) or []
    print(f"  companies: {len(rows)} rows in config/companies.py")
    if dry or not rows:
        return len(rows)
    from pymongo import UpdateOne
    ops = []
    for r in rows:
        url = r.get("linkedin_url")
        if not url:
            continue
        ops.append(UpdateOne({"linkedin_url": url},
                             {"$set": {"name": r.get("name", ""), "linkedin_url": url,
                                       "tags": r.get("tags", [])}},
                             upsert=True))
    if ops:
        res = db.companies.bulk_write(ops, ordered=False)
        print(f"    upserted: {res.upserted_count}, modified: {res.modified_count}")
    return len(rows)


def migrate_resumes(db, dry: bool) -> int:
    if not os.path.exists(RESUMES_REGISTRY):
        print("  resumes: registry.json missing — skipping")
        return 0
    with open(RESUMES_REGISTRY, "r", encoding="utf-8") as f:
        reg = json.load(f)
    resumes = reg.get("resumes", [])
    print(f"  resumes: {len(resumes)} entries in registry.json, default_id={reg.get('default_id')}")
    if dry:
        return len(resumes)
    from pymongo import UpdateOne
    ops = []
    for r in resumes:
        rid = r.get("id")
        if not rid:
            continue
        ops.append(UpdateOne({"id": rid}, {"$set": r}, upsert=True))
    if ops:
        res = db.resumes.bulk_write(ops, ordered=False)
        print(f"    upserted: {res.upserted_count}, modified: {res.modified_count}")
    db.resumes_meta.update_one({"_id": "default"},
                                {"$set": {"default_id": reg.get("default_id")}}, upsert=True)
    return len(resumes)


def migrate_search_rules(db, dry: bool) -> int:
    from config_manager import read_config  # type: ignore
    rules = read_config("search.py") or {}
    if not rules:
        print("  search rules: search.py empty — skipping")
        return 0
    print(f"  search rules: {len(rules)} keys")
    if dry:
        return 1
    db.search_rules.update_one({"_id": "current"}, {"$set": rules}, upsert=True)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be migrated, but don't write.")
    args = parser.parse_args()

    if not is_enabled():
        print("[migrate] MONGODB_URI is not set. Add it to .env or your shell, then re-run.")
        return 2

    db = get_db()
    if db is None and not args.dry_run:
        print("[migrate] Mongo is unreachable (check MONGODB_URI / Atlas IP allowlist).")
        return 3

    print(f"[migrate] target db: {MONGODB_DB}  dry_run={args.dry_run}")
    print(f"[migrate] started at {datetime.utcnow().isoformat()}Z")
    print()

    print("[migrate] hiring posts")
    migrate_posts(db, args.dry_run)
    print("[migrate] applied / failed jobs")
    migrate_applied(db, args.dry_run)
    print("[migrate] companies")
    migrate_companies(db, args.dry_run)
    print("[migrate] resumes")
    migrate_resumes(db, args.dry_run)
    print("[migrate] search rules")
    migrate_search_rules(db, args.dry_run)
    print()
    print("[migrate] done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
