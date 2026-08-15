"""Serverless-only FastAPI application for the Vercel backend project."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

os.environ.setdefault("LIFETRACE_SKIP_MIGRATIONS", "1")

from lifetrace.core.module_registry import get_module_states, register_modules
from lifetrace.routers.cloud_audio import router as cloud_audio_router

CLOUD_MODULE_IDS = frozenset(
    {
        "health",
        "auth",
        "sync",
        "todo",
        "journal",
        "habit",
        "project",
        "collection",
        "note_link",
        "chat",
        "todo_extraction",
        "zero_think",
    }
)


def _cors_origins() -> list[str]:
    configured = os.environ.get("CORS_ORIGINS", "")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


app = FastAPI(title="LifeTrace Cloud API", version="0.1.2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.registered_modules = set(
    register_modules(
        app,
        CLOUD_MODULE_IDS,
        states=get_module_states(),
        force_enabled=True,
    )
)
app.include_router(cloud_audio_router)
