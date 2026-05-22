"""
Shared API response helpers for consistent JSON output.
"""
from typing import Any, Optional


def success(data: Any = None, message: str = "ok") -> dict:
    """Standard success envelope."""
    resp = {"success": True, "message": message}
    if data is not None:
        resp["data"] = data
    return resp


def error(message: str, status_code: int = 400) -> dict:
    """Standard error envelope (use with JSONResponse for custom status)."""
    return {"success": False, "error": message}


def paginated(items: list, total: int, page: int, page_size: int) -> dict:
    """Standard paginated response envelope."""
    return {
        "success": True,
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }
