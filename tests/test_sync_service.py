from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from lifetrace.schemas.sync import SyncPushRequest
from lifetrace.services.sync_service import SyncService
from lifetrace.storage.models import Habit, HabitRecord, Journal, Todo


class _TestDatabase:
    def __init__(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(bind=self.engine)
        SQLModel.metadata.create_all(self.engine)

    @contextmanager
    def get_session(self):
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


@pytest.fixture
def sync_service(monkeypatch: pytest.MonkeyPatch) -> SyncService:
    monkeypatch.setattr(
        "lifetrace.services.todo_service.refresh_todo_reminders", lambda *_args, **_kwargs: None
    )
    monkeypatch.setattr(
        "lifetrace.services.todo_service.remove_todo_reminder_jobs", lambda *_args, **_kwargs: None
    )
    monkeypatch.setattr("lifetrace.services.journal_service.create_vector_db", lambda: None)
    return SyncService(_TestDatabase())  # type: ignore[arg-type]


def _request(client_id: str, *ops: dict[str, Any]) -> SyncPushRequest:
    return SyncPushRequest.model_validate({"clientId": client_id, "ops": list(ops)})


def _op(
    op_id: str,
    kind: str,
    uid: str,
    payload: dict[str, Any],
    *,
    depends_on: list[str] | None = None,
    base_updated_at: datetime | None = None,
    queued_at: datetime | None = None,
) -> dict[str, Any]:
    return {
        "opId": op_id,
        "kind": kind,
        "uid": uid,
        "dependsOn": depends_on or [],
        "baseUpdatedAt": base_updated_at,
        "payload": payload,
        "queuedAt": queued_at or datetime.now(UTC),
    }


def test_push_replays_an_operation_as_duplicate(sync_service: SyncService) -> None:
    request = _request(
        "phone",
        _op("op-1", "habit.create", "habit-1", {"name": "Read", "uid": "habit-1"}),
    )

    first = sync_service.push(request)
    second = sync_service.push(request)

    assert first.results[0].status == "applied"
    assert second.results[0].status == "duplicate"
    assert first.results[0].server_id == second.results[0].server_id
    with sync_service.db_base.get_session() as session:
        assert session.query(Habit).filter_by(uid="habit-1").count() == 1


def test_habit_record_set_is_state_based_and_idempotent(sync_service: SyncService) -> None:
    sync_service.push(
        _request(
            "phone",
            _op("create", "habit.create", "habit-1", {"name": "Read", "uid": "habit-1"}),
        )
    )
    date = "2026-08-15"

    sync_service.push(
        _request(
            "phone",
            _op("set-1", "habit.record_set", "habit-1", {"date": date, "recorded": True}),
            _op("set-2", "habit.record_set", "habit-1", {"date": date, "recorded": True}),
        )
    )
    with sync_service.db_base.get_session() as session:
        assert session.query(HabitRecord).count() == 1

    sync_service.push(
        _request(
            "phone",
            _op("unset-1", "habit.record_set", "habit-1", {"date": date, "recorded": False}),
            _op("unset-2", "habit.record_set", "habit-1", {"date": date, "recorded": False}),
        )
    )
    with sync_service.db_base.get_session() as session:
        assert session.query(HabitRecord).count() == 0
    pull = sync_service.pull(datetime(2026, 8, 15, tzinfo=UTC) - timedelta(days=1))
    assert [(row.entity_type, row.uid) for row in pull.tombstones] == [
        ("habit_record", "habit-1:2026-08-15")
    ]


def test_journal_conflict_preserves_server_text_in_backup(sync_service: SyncService) -> None:
    now = datetime.now(UTC)
    with sync_service.db_base.get_session() as session:
        session.add(
            Journal(
                uid="journal-1",
                name="Note",
                user_notes="server text",
                date=now,
                created_at=now,
                updated_at=now,
            )
        )

    response = sync_service.push(
        _request(
            "phone",
            _op(
                "update-note",
                "journal.update",
                "journal-1",
                {"user_notes": "client text"},
                base_updated_at=now - timedelta(minutes=5),
                queued_at=now + timedelta(minutes=1),
            ),
        )
    )

    assert response.results[0].status == "conflict"
    with sync_service.db_base.get_session() as session:
        journal = session.query(Journal).filter_by(uid="journal-1").one()
        assert journal.user_notes.startswith("client text")
        assert "【同步冲突备份" in journal.user_notes
        assert journal.user_notes.endswith("server text")


def test_delete_emits_incremental_tombstone(sync_service: SyncService) -> None:
    before = datetime.now(UTC) - timedelta(seconds=1)
    sync_service.push(
        _request(
            "phone",
            _op("create", "habit.create", "habit-1", {"name": "Read", "uid": "habit-1"}),
            _op("delete", "habit.delete", "habit-1", {}),
        )
    )

    pull = sync_service.pull(before)

    assert not pull.habits
    assert [(row.entity_type, row.uid) for row in pull.tombstones] == [("habit", "habit-1")]


def test_recreate_clears_an_older_entity_tombstone(sync_service: SyncService) -> None:
    before = datetime.now(UTC) - timedelta(seconds=1)
    sync_service.push(
        _request(
            "phone",
            _op("create-1", "habit.create", "habit-1", {"name": "Read"}),
            _op("delete", "habit.delete", "habit-1", {}),
            _op("create-2", "habit.create", "habit-1", {"name": "Read again"}),
        )
    )

    pull = sync_service.pull(before)

    assert [row["uid"] for row in pull.habits] == ["habit-1"]
    assert not [row for row in pull.tombstones if row.uid == "habit-1"]


def test_todo_dependencies_resolve_parent_uid(sync_service: SyncService) -> None:
    response = sync_service.push(
        _request(
            "phone",
            _op("parent", "todo.create", "todo-parent", {"name": "Parent"}),
            _op(
                "child",
                "todo.create",
                "todo-child",
                {"name": "Child", "parentTodoId": None},
                depends_on=["todo-parent"],
            ),
        )
    )

    assert [result.status for result in response.results] == ["applied", "applied"]
    with sync_service.db_base.get_session() as session:
        parent = session.query(Todo).filter_by(uid="todo-parent").one()
        child = session.query(Todo).filter_by(uid="todo-child").one()
        assert child.parent_todo_id == parent.id
