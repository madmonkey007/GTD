"""Regression coverage for the serverless-only FastAPI entrypoint."""

import json
from pathlib import Path

from lifetrace.vercel_app import app

MAX_DURATION_SECONDS = 60


def test_vercel_app_registers_cloud_modules_only():
    paths = {route.path for route in app.routes}

    assert "/api/auth/login" in paths
    assert "/api/sync/push" in paths
    assert "/api/todos" in paths
    assert "/api/audio/transcribe" not in paths
    assert "/uploads" not in paths


def test_vercel_config_has_a_python_api_entrypoint():
    config = json.loads(Path("vercel.json").read_text())

    assert config["functions"]["api/index.py"]["maxDuration"] == MAX_DURATION_SECONDS
