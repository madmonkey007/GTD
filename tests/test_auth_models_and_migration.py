from __future__ import annotations

import importlib

from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
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


def test_auth_migration_replaces_legacy_habit_unique_index() -> None:
    """Existing SQLite installations store this as an index, not a constraint."""
    engine = create_engine("sqlite://")
    migration = importlib.import_module(
        "lifetrace.migrations.versions.add_auth_users_002"
    )

    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE habit_records ("
            "id INTEGER PRIMARY KEY, habit_id INTEGER NOT NULL, "
            "record_date DATETIME NOT NULL, user_id INTEGER NOT NULL)"
        )
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX uq_habit_record_date "
            "ON habit_records (habit_id, record_date)"
        )
        migration.op = Operations(MigrationContext.configure(connection))
        migration._replace_sync_unique_constraints()

    unique_constraints = inspect(engine).get_unique_constraints("habit_records")
    assert any(
        constraint["name"] == "uq_habit_record_date"
        and constraint["column_names"] == ["user_id", "habit_id", "record_date"]
        for constraint in unique_constraints
    )
