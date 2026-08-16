"""Regression coverage for browser-only compatibility endpoints."""

from fastapi.testclient import TestClient

from lifetrace.vercel_app import app

client = TestClient(app)
HTTP_OK = 200


def test_cloud_compatibility_endpoints_exist_and_are_safe():
    capabilities = client.get("/api/capabilities")
    llm_status = client.get("/api/llm-status")
    config = client.get("/api/get-config")
    notifications = client.get("/api/notifications")

    assert capabilities.status_code == HTTP_OK
    assert "enabled_modules" in capabilities.json()
    assert llm_status.status_code == HTTP_OK
    assert set(llm_status.json()) == {"configured"}
    assert config.status_code == HTTP_OK
    assert config.json() == {"success": True, "config": {}}
    assert notifications.status_code == HTTP_OK
    assert notifications.json() == []


def test_cloud_config_does_not_expose_secret_environment_values(monkeypatch):
    monkeypatch.setenv("DASHSCOPE_API_KEY", "do-not-leak")
    response = client.get("/api/get-config")

    assert "do-not-leak" not in response.text
