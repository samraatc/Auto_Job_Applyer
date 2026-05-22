"""
CORS configuration for the FastAPI application.
Import configure_cors in main.py to apply.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()],
]


def configure_cors(app: FastAPI) -> None:
    """Apply CORS middleware. Call once at app startup."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
