"""Admin API tests: permission enforcement and user management."""

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

from lifetrace.core.dependencies import get_admin_auth_service, get_db_base
from lifetrace.routers.admin import router as admin_router

if TYPE_CHECKING:
    from collections.abc import Generator

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_FORBIDDEN = 403
HTTP_BAD_REQUEST = 400

# 供测试体访问 fixture 内部 sessionmaker
_app_state: dict = {}


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient]:
    monkeypatch.setenv("JWT_SECRET_KEY", "admin-test-secret")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine)
    _app_state["session_local"] = session_local

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
    app.include_router(admin_router)

    # db_base stub：tombstone 写入复用同一个 sessionmaker
    from contextlib import contextmanager as _cm

    class _DbBaseStub:
        user_id = None

        @_cm
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

    app.dependency_overrides[get_db_base] = lambda: _DbBaseStub()

    # 手动构造 admin 依赖：用内存 session
    from lifetrace.core.dependencies import bearer_scheme, get_current_user
    from lifetrace.services.auth_service import AuthService

    @contextmanager
    def svc_ctx():
        session = session_local()
        try:
            yield AuthService(session)
            session.commit()
        finally:
            session.close()

    def make_service() -> AuthService:
        return svc_ctx().__enter__()

    def override_current_user(
        credentials=Depends(bearer_scheme),
    ):
        from fastapi import HTTPException

        if credentials is None:
            raise HTTPException(status_code=401, detail="未登录")
        from lifetrace.services.auth_service import AuthTokenError, verify_access_token

        try:
            claims = verify_access_token(credentials.credentials)
        except AuthTokenError as exc:
            raise HTTPException(status_code=401, detail="登录已过期或无效") from exc
        with svc_ctx() as svc:
            user = svc.get_user_by_id(claims.user_id)
            if user is None:
                raise HTTPException(status_code=401, detail="登录已过期或无效")
            # 复制关键字段，避免 session 关闭后 detached 实例访问失败
            snapshot = SimpleNamespace(
                id=user.id, email=user.email, role=user.role, deleted_at=user.deleted_at
            )
        return snapshot

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_admin_auth_service] = make_service

    # bootstrap：注册两个用户（首个自动 admin，第二个普通用户）
    svc = make_service()
    svc.register_user(email="admin@test.com", password="password123")
    svc.register_user(email="user@test.com", password="password123")
    svc.session.commit()

    yield TestClient(app)


def _make_admin_header() -> dict[str, str]:
    from lifetrace.services.auth_service import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id=1, email='admin@test.com')}"}


def _make_user_header() -> dict[str, str]:
    from lifetrace.services.auth_service import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id=2, email='user@test.com')}"}


def test_non_admin_gets_403(client: TestClient) -> None:
    response = client.get("/api/admin/users", headers=_make_user_header())
    assert response.status_code == HTTP_FORBIDDEN


def test_admin_can_list_users(client: TestClient) -> None:
    response = client.get("/api/admin/users", headers=_make_admin_header())
    assert response.status_code == HTTP_OK
    users = response.json()
    assert len(users) == 2
    roles = {u["email"]: u["role"] for u in users}
    assert roles["admin@test.com"] == "admin"
    assert roles["user@test.com"] == "user"


def test_first_registered_user_is_admin(client: TestClient) -> None:
    """bootstrap：首个注册用户自动提权 admin"""
    response = client.get("/api/admin/users", headers=_make_admin_header())
    roles = {u["email"]: u["role"] for u in response.json()}
    assert roles["admin@test.com"] == "admin"


def test_cannot_demote_last_admin(client: TestClient) -> None:
    response = client.put(
        "/api/admin/users/1", json={"role": "user"}, headers=_make_admin_header()
    )
    assert response.status_code == HTTP_BAD_REQUEST


def test_admin_can_update_role_and_disable(client: TestClient) -> None:
    response = client.put(
        "/api/admin/users/2",
        json={"role": "admin", "disabled": True},
        headers=_make_admin_header(),
    )
    assert response.status_code == HTTP_OK
    data = response.json()
    assert data["role"] == "admin"
    assert data["disabled"] is True


# ========== 数据管理（通用 CRUD） ==========


def test_data_list_requires_admin(client: TestClient) -> None:
    response = client.get("/api/admin/data/todo", headers=_make_user_header())
    assert response.status_code == HTTP_FORBIDDEN


def test_data_unknown_resource_404(client: TestClient) -> None:
    response = client.get(
        "/api/admin/data/notexist", headers=_make_admin_header()
    )
    assert response.status_code == 404


def test_data_crud_flow(client: TestClient) -> None:
    from lifetrace.storage.models import Journal, SyncTombstone, Todo
    from lifetrace.util.time_utils import get_utc_now

    session_local = _app_state["session_local"]
    now = get_utc_now()

    with session_local() as s:
        todo = Todo(
            user_id=1, uid="admin-todo-1", name="待办A", description="desc",
            created_at=now, updated_at=now,
        )
        journal = Journal(
            user_id=1, uid="admin-journal-1", name="笔记A", user_notes="内容",
            date=now, created_at=now, updated_at=now,
        )
        s.add(todo)
        s.add(journal)
        s.commit()

    # 列表
    resp = client.get("/api/admin/data/todo", headers=_make_admin_header())
    assert resp.status_code == HTTP_OK
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "待办A"

    # 搜索
    resp = client.get(
        "/api/admin/data/todo?search=待办", headers=_make_admin_header()
    )
    assert resp.json()["total"] == 1
    resp = client.get(
        "/api/admin/data/todo?search=不存在", headers=_make_admin_header()
    )
    assert resp.json()["total"] == 0

    # 编辑（白名单字段）
    resp = client.put(
        "/api/admin/data/todo/1",
        json={"name": "待办A改", "priority": "high"},
        headers=_make_admin_header(),
    )
    assert resp.status_code == HTTP_OK
    assert resp.json()["name"] == "待办A改"

    # 非白名单字段拒绝
    resp = client.put(
        "/api/admin/data/todo/1",
        json={"uid": "hack"},
        headers=_make_admin_header(),
    )
    assert resp.status_code == HTTP_BAD_REQUEST

    # 删除 todo -> tombstone 写入
    resp = client.delete("/api/admin/data/todo/1", headers=_make_admin_header())
    assert resp.status_code == HTTP_OK
    with session_local() as s:
        assert s.query(SyncTombstone).filter_by(
            user_id=1, entity_type="todo", uid="admin-todo-1"
        ).first() is not None
        assert s.query(Todo).filter_by(id=1).first().deleted_at is not None

    # 删除后列表不再出现
    resp = client.get("/api/admin/data/todo", headers=_make_admin_header())
    assert resp.json()["total"] == 0

    # journal 删除 -> tombstone
    resp = client.delete("/api/admin/data/journal/1", headers=_make_admin_header())
    assert resp.status_code == HTTP_OK
    with session_local() as s:
        assert s.query(SyncTombstone).filter_by(
            entity_type="journal", uid="admin-journal-1"
        ).first() is not None
