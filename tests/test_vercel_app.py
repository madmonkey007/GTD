"""Regression coverage for the serverless-only FastAPI entrypoint."""

from lifetrace.vercel_app import app


def test_vercel_app_registers_cloud_modules_only():
    paths = {route.path for route in app.routes}

    assert "/api/auth/login" in paths
    assert "/api/sync/push" in paths
    assert "/api/todos" in paths
    assert "/api/audio/transcribe" not in paths
    assert "/uploads" not in paths
