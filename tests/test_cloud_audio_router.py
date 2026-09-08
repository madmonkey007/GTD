from lifetrace.vercel_app import app


def test_cloud_audio_routes_are_serverless_endpoints() -> None:
    paths = {route.path for route in app.routes}

    assert "/api/cloud-audio/probe" in paths
    assert "/api/cloud-audio/transcriptions" in paths
    assert "/api/audio/transcribe" not in paths
