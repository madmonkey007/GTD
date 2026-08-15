from __future__ import annotations

from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel

from lifetrace.storage.models import (
    Habit,
    HabitRecord,
    Journal,
    Project,
    SyncOpLog,
    SyncTombstone,
    Todo,
    User,
)

USER_OWNED_MODELS = (
    Todo,
    Journal,
    Habit,
    HabitRecord,
    Project,
    SyncOpLog,
    SyncTombstone,
)


def test_user_owned_models_have_user_id_columns() -> None:
    assert User.__tablename__ == "users"
    for model in USER_OWNED_MODELS:
        assert "user_id" in model.__table__.columns


def test_user_scoped_sync_uniqueness_allows_same_client_op_for_different_users() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(User(email="a@example.com", password_hash="hash"))
        session.add(User(email="b@example.com", password_hash="hash"))
        session.commit()

        session.add(SyncOpLog(user_id=1, client_id="phone", op_id="op-1", result_json="{}"))
        session.add(SyncOpLog(user_id=2, client_id="phone", op_id="op-1", result_json="{}"))
        session.add(SyncTombstone(user_id=1, entity_type="todo", uid="uid-1"))
        session.add(SyncTombstone(user_id=2, entity_type="todo", uid="uid-1"))
        session.commit()

        session.add(SyncOpLog(user_id=1, client_id="phone", op_id="op-1", result_json="{}"))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        else:
            raise AssertionError("duplicate (user_id, client_id, op_id) must be rejected")

        session.add(SyncTombstone(user_id=1, entity_type="todo", uid="uid-1"))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
        else:
            raise AssertionError("duplicate (user_id, entity_type, uid) must be rejected")


def test_user_scoped_indexes_exist() -> None:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    inspector = inspect(engine)

    todo_indexes = {index["name"] for index in inspector.get_indexes("todos")}
    journal_indexes = {index["name"] for index in inspector.get_indexes("journals")}
    habit_indexes = {index["name"] for index in inspector.get_indexes("habits")}
    project_indexes = {index["name"] for index in inspector.get_indexes("projects")}

    assert "ix_todos_user_id_uid" in todo_indexes
    assert "ix_journals_user_id_uid" in journal_indexes
    assert "ix_habits_user_id_uid" in habit_indexes
    assert "ix_projects_user_id_uid" in project_indexes
