from __future__ import annotations

from contextlib import contextmanager
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
from lifetrace.routers.auth import router as auth_router
from lifetrace.routers.habit import router as habit_router
from lifetrace.routers.journal import router as journal_router
from lifetrace.routers.project import router as project_router
from lifetrace.routers.todo import router as todo_router

if TYPE_CHECKING:
    from collections.abc import Generator

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_NOT_FOUND = 404


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient]:
    monkeypatch.setenv("JWT_SECRET_KEY", "isolation-test-secret")
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
    for router in (auth_router, todo_router, journal_router, habit_router, project_router):
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


def test_todos_are_isolated_between_users(client: TestClient) -> None:
    user_a = _register(client, "a@example.com")
    user_b = _register(client, "b@example.com")

    created = client.post("/api/todos", json={"name": "A todo"}, headers=user_a)
    assert created.status_code == HTTP_CREATED
    todo_id = created.json()["id"]

    assert client.get("/api/todos", headers=user_a).json()["total"] == 1
    assert client.get("/api/todos", headers=user_b).json()["total"] == 0
    assert client.get(f"/api/todos/{todo_id}", headers=user_b).status_code == HTTP_NOT_FOUND

    blocked = client.put(f"/api/todos/{todo_id}", json={"name": "B edit"}, headers=user_b)
    assert blocked.status_code == HTTP_NOT_FOUND


def test_habits_are_isolated_between_users(client: TestClient) -> None:
    user_a = _register(client, "a@example.com")
    user_b = _register(client, "b@example.com")

    created = client.post("/api/habits", json={"name": "Read"}, headers=user_a)
    assert created.status_code == HTTP_CREATED
    habit_id = created.json()["id"]

    assert client.get("/api/habits", headers=user_a).json()["total"] == 1
    assert client.get("/api/habits", headers=user_b).json()["total"] == 0
    assert client.get(f"/api/habits/{habit_id}", headers=user_b).status_code == HTTP_NOT_FOUND

    blocked = client.put(f"/api/habits/{habit_id}", json={"name": "B edit"}, headers=user_b)
    assert blocked.status_code == HTTP_NOT_FOUND


def test_journals_are_isolated_between_users(client: TestClient) -> None:
    user_a = _register(client, "a@example.com")
    user_b = _register(client, "b@example.com")

    created = client.post(
        "/api/journals",
        json={
            "name": "A journal",
            "user_notes": "private",
            "date": "2026-08-15T00:00:00Z",
        },
        headers=user_a,
    )
    assert created.status_code == HTTP_CREATED
    journal_id = created.json()["id"]

    assert client.get("/api/journals", headers=user_a).json()["total"] == 1
    assert client.get("/api/journals", headers=user_b).json()["total"] == 0
    assert client.get(f"/api/journals/{journal_id}", headers=user_b).status_code == HTTP_NOT_FOUND

    blocked = client.put(
        f"/api/journals/{journal_id}",
        json={"name": "B edit"},
        headers=user_b,
    )
    assert blocked.status_code == HTTP_NOT_FOUND


def test_projects_are_isolated_between_users(client: TestClient) -> None:
    user_a = _register(client, "a@example.com")
    user_b = _register(client, "b@example.com")

    created = client.post("/api/projects", json={"name": "A project"}, headers=user_a)
    assert created.status_code == HTTP_CREATED
    project_id = created.json()["id"]

    user_a_projects = client.get("/api/projects", headers=user_a).json()
    user_b_projects = client.get("/api/projects", headers=user_b).json()

    assert {project["name"] for project in user_a_projects} == {
        "A project",
        "执行清单",
        "等待清单",
        "可能清单",
    }
    assert {project["name"] for project in user_b_projects} == {
        "执行清单",
        "等待清单",
        "可能清单",
    }
    assert client.get(f"/api/projects/{project_id}", headers=user_b).status_code == HTTP_NOT_FOUND

    blocked = client.put(
        f"/api/projects/{project_id}",
        json={"name": "B edit"},
        headers=user_b,
    )
    assert blocked.status_code == HTTP_NOT_FOUND
