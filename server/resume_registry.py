"""
Resume registry: tracks multiple resumes under all resumes/<id>/resume.pdf
and exposes which one is currently default.

The registry file lives at all resumes/registry.json.
On every save() we also write config/questions.py:default_resume_path to the
default entry's path so runAiBot.py keeps working unchanged.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, UploadFile

from config_manager import write_config

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RESUMES_DIR = os.path.join(PROJECT_ROOT, "all resumes")
REGISTRY_FILE = os.path.join(RESUMES_DIR, "registry.json")
MAX_BYTES = 5 * 1024 * 1024


def _load() -> dict:
    if not os.path.exists(REGISTRY_FILE):
        return {"resumes": [], "default_id": None}
    with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(data: dict) -> None:
    os.makedirs(RESUMES_DIR, exist_ok=True)
    with open(REGISTRY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    _sync_questions_default(data)


def _sync_questions_default(data: dict) -> None:
    default = next((r for r in data["resumes"] if r["id"] == data.get("default_id")), None)
    if default:
        write_config("questions.py", {"default_resume_path": default["path"]})


def _bootstrap_default() -> dict:
    legacy = os.path.join(RESUMES_DIR, "default", "resume.pdf")
    data = {"resumes": [], "default_id": None}
    if os.path.exists(legacy):
        rid = "default"
        data["resumes"].append({
            "id": rid,
            "label": "Default",
            "path": "all resumes/default/resume.pdf",
            "tags": [],
            "uploaded_at": datetime.utcnow().isoformat() + "Z",
        })
        data["default_id"] = rid
    _save(data)
    return data


def list_resumes() -> dict:
    if not os.path.exists(REGISTRY_FILE):
        return _bootstrap_default()
    return _load()


def get_default_path() -> Optional[str]:
    data = list_resumes()
    if not data["default_id"]:
        return None
    entry = next((r for r in data["resumes"] if r["id"] == data["default_id"]), None)
    return entry["path"] if entry else None


def _slug(label: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]+", "_", label.strip()).strip("_").lower()
    return s or uuid.uuid4().hex[:8]


async def upload_resume(file: UploadFile, label: str, tags: list[str], make_default: bool) -> dict:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are accepted")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_BYTES // 1024 // 1024}MB limit")

    data = list_resumes()
    rid = _slug(label) + "_" + uuid.uuid4().hex[:6]
    folder = os.path.join(RESUMES_DIR, rid)
    os.makedirs(folder, exist_ok=True)
    path_abs = os.path.join(folder, "resume.pdf")
    with open(path_abs, "wb") as f:
        f.write(content)

    entry = {
        "id": rid,
        "label": label or rid,
        "path": f"all resumes/{rid}/resume.pdf",
        "tags": tags or [],
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
    }
    data["resumes"].append(entry)
    if make_default or not data["default_id"]:
        data["default_id"] = rid
    _save(data)
    return entry


def set_default(resume_id: str) -> dict:
    data = list_resumes()
    if not any(r["id"] == resume_id for r in data["resumes"]):
        raise HTTPException(status_code=404, detail="Resume not found")
    data["default_id"] = resume_id
    _save(data)
    return data


def delete_resume(resume_id: str) -> dict:
    data = list_resumes()
    entry = next((r for r in data["resumes"] if r["id"] == resume_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Resume not found")
    if data["default_id"] == resume_id and len(data["resumes"]) > 1:
        raise HTTPException(status_code=400, detail="Set another resume as default before deleting this one")
    folder = os.path.join(RESUMES_DIR, resume_id)
    if os.path.isdir(folder):
        shutil.rmtree(folder, ignore_errors=True)
    data["resumes"] = [r for r in data["resumes"] if r["id"] != resume_id]
    if data["default_id"] == resume_id:
        data["default_id"] = None
    _save(data)
    return data
