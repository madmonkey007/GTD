"""cloud-audio probe 路由测试（通道探测契约）。"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from lifetrace.routers.cloud_audio import router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_probe_reports_cloud_transport_and_configured(monkeypatch):
    monkeypatch.setenv("DASHSCOPE_API_KEY", "sk-test")
    resp = _client().get("/api/cloud-audio/probe")
    assert resp.status_code == 200  # noqa: PLR2004
    body = resp.json()
    assert body["transport"] == "cloud"
    assert body["asr_configured"] is True


def test_probe_reports_unconfigured_without_key(monkeypatch):
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    resp = _client().get("/api/cloud-audio/probe")
    assert resp.status_code == 200  # noqa: PLR2004
    body = resp.json()
    assert body["transport"] == "cloud"
    assert body["asr_configured"] is False
    # 探测不得泄露 ASR Key
    assert "sk-" not in resp.text
