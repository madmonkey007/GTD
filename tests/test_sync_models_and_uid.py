from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select

from lifetrace.schemas.habit import HabitCreate
from lifetrace.schemas.project import ProjectCreate
from lifetrace.services.habit_service import HabitService
from lifetrace.services.project_service import ProjectService
from lifetrace.storage.models import SyncOpLog, SyncTombstone


class _HabitRepository:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.create_calls = 0

    def get_by_uid(self, uid: str) -> dict[str, Any] | None:
        return self.rows.get(uid)

    def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        self.create_calls += 1
        now = datetime.now(UTC)
        row = {
            "id": self.create_calls,
            "uid": fields["uid"],
            "created_at": now,
            "updated_at": now,
            **fields,
        }
        self.rows[row["uid"]] = row
        return row


class _ProjectRepository:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.create_calls = 0

    def get_by_uid(self, uid: str) -> dict[str, Any] | None:
        return self.rows.get(uid)

    def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        self.create_calls += 1
        now = datetime.now(UTC)
        row = {
            "id": self.create_calls,
            "uid": fields["uid"],
            "created_at": now,
            "updated_at": now,
            "todo_count": 0,
            "note_count": 0,
            **fields,
        }
        self.rows[row["uid"]] = row
        return row


def test_sync_log_and_tombstone_uniqueness() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    now = datetime.now(UTC)

    with Session(engine) as session:
        session.add(SyncOpLog(client_id="phone", op_id="op-1", result_json="{}", created_at=now))
        session.add(SyncTombstone(entity_type="todo", uid="uid-1", deleted_at=now))
        session.commit()

        assert session.exec(select(SyncOpLog)).one().op_id == "op-1"
        assert session.exec(select(SyncTombstone)).one().uid == "uid-1"

        session.add(SyncOpLog(client_id="phone", op_id="op-1", result_json="{}", created_at=now))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        else:
            raise AssertionError("duplicate (client_id, op_id) must be rejected")

        session.add(SyncTombstone(entity_type="todo", uid="uid-1", deleted_at=now))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        else:
            raise AssertionError("duplicate (entity_type, uid) must be rejected")


def test_habit_create_is_uid_upsert() -> None:
    repository = _HabitRepository()
    service = HabitService(repository)  # type: ignore[arg-type]
    request = HabitCreate(name="Read", uid="habit-uid")

    first = service.create_habit(request)
    second = service.create_habit(request)

    assert first.id == second.id
    assert first.uid == "habit-uid"
    assert repository.create_calls == 1


def test_project_create_is_uid_upsert() -> None:
    repository = _ProjectRepository()
    service = ProjectService(repository, object(), object())  # type: ignore[arg-type]
    request = ProjectCreate(name="Offline", uid="project-uid")

    first = service.create_project(request)
    second = service.create_project(request)

    assert first.id == second.id
    assert first.uid == "project-uid"
    assert repository.create_calls == 1
