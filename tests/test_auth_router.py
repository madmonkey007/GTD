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

if TYPE_CHECKING:
    from collections.abc import Generator

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_UNAUTHORIZED = 401
HTTP_CONFLICT = 409


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient]:
    monkeypatch.setenv("JWT_SECRET_KEY", "router-test-secret")
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
    with TestClient(app) as test_client:
        yield test_client


def test_register_returns_token_and_user(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "  User@Example.COM ",
            "password": "long-enough-password",
            "display_name": "User",
        },
    )

    assert response.status_code == HTTP_CREATED
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"] == {
        "id": 1,
        "email": "user@example.com",
        "display_name": "User",
    }


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    payload = {"email": "user@example.com", "password": "long-enough-password"}

    assert client.post("/api/auth/register", json=payload).status_code == HTTP_CREATED
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == HTTP_CONFLICT


def test_login_returns_token_for_correct_password(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": "long-enough-password"},
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "USER@example.com", "password": "long-enough-password"},
    )

    assert response.status_code == HTTP_OK
    assert response.json()["user"]["email"] == "user@example.com"
    assert response.json()["access_token"]


def test_login_rejects_wrong_password(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": "long-enough-password"},
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )

    assert response.status_code == HTTP_UNAUTHORIZED


def test_me_requires_token(client: TestClient) -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == HTTP_UNAUTHORIZED


def test_me_returns_current_user(client: TestClient) -> None:
    register = client.post(
        "/api/auth/register",
        json={
            "email": "user@example.com",
            "password": "long-enough-password",
            "display_name": "User",
        },
    )
    token = register.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == HTTP_OK
    assert response.json() == {
        "id": 1,
        "email": "user@example.com",
        "display_name": "User",
    }
