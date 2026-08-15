"""add users and user ownership columns

Revision ID: add_auth_users_002
Revises: add_sync_001
Create Date: 2026-08-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_auth_users_002"
down_revision: str | None = "add_sync_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BOOTSTRAP_EMAIL = "bootstrap@lifetrace.local"
BOOTSTRAP_HASH = "disabled-bootstrap-account"
USER_TABLES = ("todos", "journals", "habits", "habit_records", "projects")


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(name: str) -> bool:
    return _inspector().has_table(name)


def _columns(table: str) -> set[str]:
    if not _has_table(table):
        return set()
    return {column["name"] for column in _inspector().get_columns(table)}


def _has_column(table: str, column: str) -> bool:
    return column in _columns(table)


def _has_index(table: str, name: str) -> bool:
    if not _has_table(table):
        return False
    return any(index.get("name") == name for index in _inspector().get_indexes(table))


def _has_unique(table: str, name: str) -> bool:
    if not _has_table(table):
        return False
    return any(
        constraint.get("name") == name for constraint in _inspector().get_unique_constraints(table)
    )


def upgrade() -> None:
    _create_users_table()
    bootstrap_user_id = _ensure_bootstrap_user()

    for table in USER_TABLES:
        _add_user_id_column(table, bootstrap_user_id)

    _add_user_id_column("sync_op_log", bootstrap_user_id)
    _add_user_id_column("sync_tombstones", bootstrap_user_id)

    _create_user_indexes()
    _replace_sync_unique_constraints()


def downgrade() -> None:
    _drop_sync_unique_constraints()
    for table in ("sync_tombstones", "sync_op_log", *reversed(USER_TABLES)):
        if _has_table(table) and _has_column(table, "user_id"):
            with op.batch_alter_table(table) as batch:
                batch.drop_column("user_id")
    if _has_table("users"):
        op.drop_table("users")


def _create_users_table() -> None:
    if _has_table("users"):
        return
    op.create_table(
        "users",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])


def _ensure_bootstrap_user() -> int:
    connection = op.get_bind()
    existing = connection.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": BOOTSTRAP_EMAIL},
    ).fetchone()
    if existing:
        return int(existing[0])

    params = {
        "email": BOOTSTRAP_EMAIL,
        "password_hash": BOOTSTRAP_HASH,
        "display_name": "Bootstrap",
    }
    statement = (
        "INSERT INTO users "
        "(email, password_hash, display_name, created_at, updated_at) "
        "VALUES (:email, :password_hash, :display_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    )
    if connection.dialect.name == "postgresql":
        return int(connection.execute(sa.text(statement + " RETURNING id"), params).scalar_one())
    result = connection.execute(sa.text(statement), params)
    return int(result.lastrowid)


def _add_user_id_column(table: str, bootstrap_user_id: int) -> None:
    if not _has_table(table) or _has_column(table, "user_id"):
        return
    with op.batch_alter_table(table) as batch:
        batch.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
    op.execute(
        sa.text(f"UPDATE {table} SET user_id = :user_id WHERE user_id IS NULL").bindparams(
            user_id=bootstrap_user_id
        )
    )
    with op.batch_alter_table(table) as batch:
        batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
    op.create_index(f"ix_{table}_user_id", table, ["user_id"])


def _create_user_indexes() -> None:
    for table in ("todos", "journals", "habits", "projects"):
        name = f"ix_{table}_user_id_uid"
        if _has_table(table) and not _has_index(table, name):
            op.create_index(name, table, ["user_id", "uid"])
    for table in ("habit_records", "sync_op_log", "sync_tombstones"):
        name = f"ix_{table}_user_id"
        if _has_table(table) and not _has_index(table, name):
            op.create_index(name, table, ["user_id"])


def _replace_sync_unique_constraints() -> None:
    if _has_table("sync_op_log"):
        with op.batch_alter_table("sync_op_log") as batch:
            if _has_unique("sync_op_log", "uq_sync_op_log_client_op"):
                batch.drop_constraint("uq_sync_op_log_client_op", type_="unique")
            batch.create_unique_constraint(
                "uq_sync_op_log_client_op",
                ["user_id", "client_id", "op_id"],
            )
    if _has_table("sync_tombstones"):
        with op.batch_alter_table("sync_tombstones") as batch:
            if _has_unique("sync_tombstones", "uq_sync_tombstone_entity_uid"):
                batch.drop_constraint("uq_sync_tombstone_entity_uid", type_="unique")
            batch.create_unique_constraint(
                "uq_sync_tombstone_entity_uid",
                ["user_id", "entity_type", "uid"],
            )
    if _has_table("habit_records"):
        with op.batch_alter_table("habit_records") as batch:
            if _has_unique("habit_records", "uq_habit_record_date"):
                batch.drop_constraint("uq_habit_record_date", type_="unique")
            elif _has_index("habit_records", "uq_habit_record_date"):
                batch.drop_index("uq_habit_record_date")
            batch.create_unique_constraint(
                "uq_habit_record_date",
                ["user_id", "habit_id", "record_date"],
            )


def _drop_sync_unique_constraints() -> None:
    specs = (
        ("sync_op_log", "uq_sync_op_log_client_op", ["client_id", "op_id"]),
        ("sync_tombstones", "uq_sync_tombstone_entity_uid", ["entity_type", "uid"]),
        ("habit_records", "uq_habit_record_date", ["habit_id", "record_date"]),
    )
    for table, name, columns in specs:
        if not _has_table(table):
            continue
        with op.batch_alter_table(table) as batch:
            if _has_unique(table, name):
                batch.drop_constraint(name, type_="unique")
            batch.create_unique_constraint(name, columns)
