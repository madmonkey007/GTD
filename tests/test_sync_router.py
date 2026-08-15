from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from lifetrace.core.dependencies import get_db_base
from lifetrace.core.module_registry import MODULE_INDEX
from lifetrace.routers.auth import router as auth_router
from lifetrace.routers.sync import router

if TYPE_CHECKING:
    from collections.abc import Generator

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_UNAUTHORIZED = 401


def test_sync_router_exposes_push_and_pull_as_a_core_module() -> None:
    routes = {(route.path, method) for route in router.routes for method in route.methods}

    assert ("/api/sync/push", "POST") in routes
    assert ("/api/sync/pull", "GET") in routes
    assert MODULE_INDEX["sync"].core is True


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient]:
    monkeypatch.setenv("JWT_SECRET_KEY", "sync-router-test-secret")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine)

    @contextmanager
    def get_session():
        session = session_local()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app = FastAPI()
    app.dependency_overrides[get_db_base] = lambda: SimpleNamespace(
        SessionLocal=session_local,
        get_session=get_session,
    )
    app.include_router(auth_router)
    app.include_router(router)
    with TestClient(app) as test_client:
        yield test_client


def _register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "long-enough-password"},
    )
    assert response.status_code == HTTP_CREATED
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _habit_create_op(op_id: str, uid: str, name: str) -> dict[str, object]:
    return {
        "opId": op_id,
        "kind": "habit.create",
        "uid": uid,
        "dependsOn": [],
        "payload": {"name": name},
        "queuedAt": datetime(2026, 8, 15, tzinfo=UTC).isoformat(),
    }


def test_sync_push_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/sync/push", json={"clientId": "client-a", "ops": []})

    assert response.status_code == HTTP_UNAUTHORIZED


def test_sync_pull_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/sync/pull")

    assert response.status_code == HTTP_UNAUTHORIZED


def test_sync_data_is_isolated_between_users(client: TestClient) -> None:
    user_a = _register(client, "a@example.com")
    user_b = _register(client, "b@example.com")

    pushed_a = client.post(
        "/api/sync/push",
        json={
            "clientId": "device-a",
            "ops": [_habit_create_op("op-a", "shared-habit-uid", "A habit")],
        },
        headers=user_a,
    )
    assert pushed_a.status_code == HTTP_OK

    pulled_b = client.get("/api/sync/pull", headers=user_b)
    assert pulled_b.status_code == HTTP_OK
    assert pulled_b.json()["habits"] == []

    pushed_b = client.post(
        "/api/sync/push",
        json={
            "clientId": "device-b",
            "ops": [_habit_create_op("op-b", "shared-habit-uid", "B habit")],
        },
        headers=user_b,
    )
    assert pushed_b.status_code == HTTP_OK

    assert pushed_a.json()["results"][0]["serverId"] != pushed_b.json()["results"][0]["serverId"]
    assert client.get("/api/sync/pull", headers=user_a).json()["habits"][0]["name"] == "A habit"
    assert client.get("/api/sync/pull", headers=user_b).json()["habits"][0]["name"] == "B habit"
