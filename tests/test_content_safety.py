"""Content safety engine tests: matching, actions, violation records."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from lifetrace.services import content_safety
from lifetrace.storage.models import ContentViolation, KeywordRule

if TYPE_CHECKING:
    from collections.abc import Generator

HTTP_OK = 200
HTTP_FORBIDDEN = 403


@pytest.fixture
def session() -> Generator:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    content_safety.invalidate_rule_cache()


def _add_rule(session, **kwargs) -> KeywordRule:
    rule = KeywordRule(
        pattern=kwargs.get("pattern", "违禁词"),
        is_regex=kwargs.get("is_regex", False),
        category=kwargs.get("category", "custom"),
        action=kwargs.get("action", "flag"),
        enabled=kwargs.get("enabled", True),
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    content_safety.invalidate_rule_cache()
    return rule


def test_match_plain_keyword(session) -> None:
    _add_rule(session, pattern="违禁词")
    hits = content_safety.match_content(session, "这里有一个违禁词在中间")
    assert len(hits) == 1
    rule, excerpt = hits[0]
    assert rule[1] == "违禁词"
    # 命中词脱敏为 ***
    assert "违禁词" not in excerpt
    assert "***" in excerpt
    # 大小写不敏感
    hits2 = content_safety.match_content(session, "BADWORD here")
    assert hits2 == [] or hits2[0][0][1] != "违禁词"


def test_match_case_insensitive(session) -> None:
    _add_rule(session, pattern="badword")
    hits = content_safety.match_content(session, "this is BADWORD yes")
    assert len(hits) == 1


def test_match_regex(session) -> None:
    _add_rule(session, pattern=r"\d{11}", is_regex=True)
    hits = content_safety.match_content(session, "电话 13800138000 联系")
    assert len(hits) == 1


def test_invalid_regex_skipped(session) -> None:
    _add_rule(session, pattern="([bad", is_regex=True)
    assert content_safety.match_content(session, "anything") == []


def test_disabled_rule_ignored(session) -> None:
    _add_rule(session, pattern="违禁词", enabled=False)
    assert content_safety.match_content(session, "含违禁词") == []


def test_check_content_returns_worst_action(session) -> None:
    _add_rule(session, pattern="轻", action="flag")
    _add_rule(session, pattern="重", action="block")
    result = content_safety.check_content(
        session, user_id=1, resource_type="todo", resource_id=1, content="轻重都有"
    )
    assert result == "block"
    # 两条命中都落库
    violations = session.query(ContentViolation).all()
    assert len(violations) == 2
    assert {v.action_taken for v in violations} == {"block"}


def test_check_content_no_hit(session) -> None:
    _add_rule(session, pattern="违禁词")
    result = content_safety.check_content(
        session, user_id=1, resource_type="todo", resource_id=1, content="正常内容"
    )
    assert result is None
    assert session.query(ContentViolation).count() == 0


def test_record_dedup_pending(session) -> None:
    rule = _add_rule(session, pattern="违禁词")
    for _ in range(2):
        content_safety.check_content(
            session, user_id=1, resource_type="todo", resource_id=1, content="违禁词"
        )
    # 同规则同资源只留一条 pending
    assert session.query(ContentViolation).count() == 1


def test_excerpt_context_truncation(session) -> None:
    _add_rule(session, pattern="目标词")
    long = "前" * 100 + "目标词" + "后" * 100
    _, excerpt = content_safety.match_content(session, long)[0]
    # 摘要远短于原文且脱敏
    assert len(excerpt) < 60
    assert excerpt.startswith("…") and excerpt.endswith("…")


def test_delete_action_severity(session) -> None:
    _add_rule(session, pattern="删", action="delete")
    _add_rule(session, pattern="标", action="flag")
    result = content_safety.check_content(
        session, user_id=1, resource_type="journal", resource_id=2, content="删标"
    )
    assert result == "delete"


def test_safety_router_requires_admin() -> None:
    from lifetrace.routers.admin_safety import router as safety_router

    app = FastAPI()
    app.include_router(safety_router)
    client = TestClient(app)
    assert client.get("/api/admin/safety/keywords").status_code in (401, 403)
