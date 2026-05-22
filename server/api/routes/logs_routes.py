"""
Logs API — summary stats and recent activity for the Dashboard.
Reads from the existing store (CSV / MongoDB) without breaking
the original data layer.
"""
from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from datetime import datetime, timedelta
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.auth_handler import get_current_user_id

router = APIRouter(prefix="/logs", tags=["logs"])


def _load_applied():
    """Load applied jobs from the existing store, return list of dicts."""
    try:
        from store import list_applied
        result = list_applied(page=1, page_size=10000)
        return result.get("items", result) if isinstance(result, dict) else result
    except Exception:
        return []


def _load_manual():
    try:
        from store import list_manual_apply
        result = list_manual_apply(page=1, page_size=10000)
        return result.get("items", result) if isinstance(result, dict) else result
    except Exception:
        return []


def _count_resumes():
    try:
        from resume_registry import list_resumes
        data = list_resumes()
        return len(data.get("resumes", []))
    except Exception:
        return 0


# ── GET /api/logs/summary ─────────────────────────────────────────
@router.get("/summary")
def get_summary(user_id: str = Depends(get_current_user_id)):
    """Return aggregate statistics for the dashboard stat cards."""
    applied = _load_applied()

    total_applied = len(applied)
    interviews = sum(
        1 for a in applied
        if str(a.get("status", "")).lower() in ("interview", "interviewing", "phone screen")
    )
    viewed = sum(
        1 for a in applied
        if str(a.get("status", "")).lower() in ("viewed", "application viewed")
    )
    resumes = _count_resumes()

    return {
        "applied":    total_applied,
        "viewed":     viewed,
        "interviews": interviews,
        "resumes":    resumes,
    }


# ── GET /api/logs/recent ──────────────────────────────────────────
@router.get("/recent")
def get_recent(
    limit: int = Query(default=5, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
):
    """Return the most recent job application events for the activity feed."""
    applied = _load_applied()

    # Sort by date descending (best-effort — field name varies)
    def _date(item):
        for key in ("applied_at", "date", "timestamp", "created_at"):
            val = item.get(key)
            if val:
                try:
                    return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
                except Exception:
                    pass
        return datetime.min

    recent = sorted(applied, key=_date, reverse=True)[:limit]

    result = []
    for item in recent:
        status_raw = str(item.get("status", "applied")).lower()
        # Normalise to one of: applied / viewed / interview / rejected
        if "interview" in status_raw or "screen" in status_raw:
            status = "interview"
        elif "view" in status_raw:
            status = "viewed"
        elif "reject" in status_raw or "declin" in status_raw:
            status = "rejected"
        else:
            status = "applied"

        date_val = _date(item)
        if date_val == datetime.min:
            time_str = "—"
        elif (datetime.utcnow() - date_val.replace(tzinfo=None)) < timedelta(hours=24):
            time_str = "Today"
        elif (datetime.utcnow() - date_val.replace(tzinfo=None)) < timedelta(hours=48):
            time_str = "Yesterday"
        else:
            time_str = date_val.strftime("%-d %b") if os.name != "nt" else date_val.strftime("%d %b")

        result.append({
            "company": item.get("company", item.get("employer", "Unknown")),
            "role":    item.get("job_title", item.get("position", item.get("title", "Unknown Role"))),
            "status":  status,
            "time":    time_str,
        })

    return result
