"""Admin safety API tests: keyword CRUD, violations, resolve, scan, stats."""

from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from lifetrace.core.dependencies import get_current_admin, get_db_base, get_db_session
from lifetrace.routers.admin_safety import router as safety_router
from lifetrace.services import content_safety
from lifetrace.util.time_utils import get_utc_now
from lifetrace.storage.models import (
    ContentViolation,
    Journal,
    KeywordRule,
    SyncTombstone,
    Todo,
)

if TYPE_CHECKING:
    from collections.abc import Generator

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_NOT_FOUND = 404
HTTP_UNPROCESSABLE = 422

_admin_user = SimpleNamespace(id=1, email="admin@test.local", role="admin")

_app_state: dict = {}


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine)
    _app_state["session_local"] = session_local

    class _DbBaseStub:
        user_id = None
        SessionLocal = session_local

        @contextmanager
        def get_session(self):
            session = session_local()
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()

    db_stub = _DbBaseStub()

    def _override_session():
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
    app.include_router(safety_router)
    app.dependency_overrides[get_db_session] = _override_session
    app.dependency_overrides[get_db_base] = lambda: db_stub
    app.dependency_overrides[get_current_admin] = lambda: _admin_user

    with TestClient(app) as c:
        yield c


def _create_rule(client: TestClient, **overrides) -> dict:
    payload = {"pattern": "违禁词", "action": "flag", **overrides}
    resp = client.post("/api/admin/safety/keywords", json=payload)
    assert resp.status_code == HTTP_CREATED
    content_safety.invalidate_rule_cache()
    return resp.json()


def test_keyword_crud(client: TestClient) -> None:
    rule = _create_rule(client, pattern="测试词", action="block", category="ad")

    resp = client.get("/api/admin/safety/keywords")
    assert resp.status_code == HTTP_OK
    assert len(resp.json()) == 1

    resp = client.put(
        f"/api/admin/safety/keywords/{rule['id']}",
        json={"pattern": "测试词", "action": "flag", "enabled": False},
    )
    assert resp.status_code == HTTP_OK
    assert resp.json()["enabled"] is False

    resp = client.delete(f"/api/admin/safety/keywords/{rule['id']}")
    assert resp.status_code == HTTP_OK
    assert client.get("/api/admin/safety/keywords").json() == []


def test_keyword_invalid_action_400(client: TestClient) -> None:
    resp = client.post(
        "/api/admin/safety/keywords", json={"pattern": "x", "action": "nuke"}
    )
    assert resp.status_code == HTTP_BAD_REQUEST


def test_keyword_batch_import(client: TestClient) -> None:
    resp = client.post(
        "/api/admin/safety/keywords/batch",
        json={"patterns": ["a", "b", " a ", ""], "action": "flag"},
    )
    assert resp.status_code == HTTP_OK
    assert resp.json()["created"] == 2  # 去重 + 跳过空


def test_violations_list_and_resolve_delete(client: TestClient) -> None:
    session_local = _app_state["session_local"]
    rule = _create_rule(client, pattern="违禁词", action="delete")

    # 直插一条待办 + 一条命中记录
    with session_local() as s:
        todo = Todo(uid="t1", user_id=7, name="含违禁词的待办")
        s.add(todo)
        s.commit()
        s.refresh(todo)
        todo_id = todo.id
        violation = ContentViolation(
            user_id=7,
            resource_type="todo",
            resource_id=todo_id,
            rule_id=rule["id"],
            rule_pattern="违禁词",
            matched_excerpt="含***的待办",
            action_taken="delete",
            status="pending",
        )
        s.add(violation)
        s.commit()
        s.refresh(violation)
        violation_id = violation.id

    resp = client.get("/api/admin/safety/violations", params={"status": "pending"})
    assert resp.status_code == HTTP_OK
    assert resp.json()["total"] == 1

    # 处置 delete：软删 + 墓碑
    resp = client.post(
        f"/api/admin/safety/violations/{violation_id}/resolve",
        json={"decision": "delete"},
    )
    assert resp.status_code == HTTP_OK

    with session_local() as s:
        todo = s.query(Todo).filter(Todo.id == todo_id).first()
        assert todo is not None and todo.deleted_at is not None
        tomb = (
            s.query(SyncTombstone)
            .filter(
                SyncTombstone.entity_type == "todo", SyncTombstone.uid == "t1"
            )
            .first()
        )
        assert tomb is not None
        v = s.query(ContentViolation).filter(ContentViolation.id == violation_id).first()
        assert v is not None and v.status == "resolved"

    # 处置后列表无 pending
    assert (
        client.get("/api/admin/safety/violations", params={"status": "pending"}).json()[
            "total"
        ]
        == 0
    )


def test_resolve_ignore(client: TestClient) -> None:
    session_local = _app_state["session_local"]
    with session_local() as s:
        v = ContentViolation(
            user_id=1,
            resource_type="journal",
            resource_id=1,
            rule_id=1,
            rule_pattern="x",
            matched_excerpt="x",
            action_taken="flag",
            status="pending",
        )
        s.add(v)
        s.commit()
        s.refresh(v)
        vid = v.id

    resp = client.post(
        f"/api/admin/safety/violations/{vid}/resolve", json={"decision": "ignore"}
    )
    assert resp.status_code == HTTP_OK
    with session_local() as s:
        v = s.query(ContentViolation).filter(ContentViolation.id == vid).first()
        assert v is not None and v.status == "ignored"


def test_resolve_bad_decision_400(client: TestClient) -> None:
    resp = client.post(
        "/api/admin/safety/violations/999/resolve", json={"decision": "boom"}
    )
    assert resp.status_code == HTTP_BAD_REQUEST


def test_scan(client: TestClient) -> None:
    session_local = _app_state["session_local"]
    _create_rule(client, pattern="违禁词", action="flag")
    with session_local() as s:
        s.add(Todo(uid="t2", user_id=1, name="正常待办"))
        s.add(Todo(uid="t3", user_id=1, name="含违禁词内容"))
        s.add(Journal(uid="j1", user_id=1, name="笔记", user_notes="违禁词在正文", date=get_utc_now()))
        s.commit()

    resp = client.post("/api/admin/safety/scan")
    assert resp.status_code == HTTP_OK
    body = resp.json()
    assert body["scanned"] == 3
    assert body["hits"] == 2

    resp = client.get("/api/admin/safety/stats")
    assert resp.status_code == HTTP_OK
    stats = resp.json()
    assert stats["pending_violations"] == 2
    assert stats["enabled_rules"] == 1
