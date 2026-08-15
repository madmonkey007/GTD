from lifetrace.routers.cloud_audio import _extract_transcription_text
from lifetrace.vercel_app import app


def test_cloud_audio_routes_are_serverless_endpoints() -> None:
    paths = {route.path for route in app.routes}

    assert "/api/cloud-audio/uploads" in paths
    assert "/api/cloud-audio/transcriptions/{task_id}" in paths
    assert "/api/audio/transcribe" not in paths


def test_extracts_text_from_dashscope_transcription_json() -> None:
    payload = {
        "transcripts": [
            {"text": "今天完成部署。"},
            {"text": "明天继续测试。"},
        ]
    }

    assert _extract_transcription_text(payload) == "今天完成部署。\n明天继续测试。"
