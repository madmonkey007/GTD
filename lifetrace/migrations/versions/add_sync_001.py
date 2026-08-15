"""add offline-first synchronization tables and indexes

Revision ID: add_sync_001
Revises: add_projects_001
Create Date: 2026-08-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_sync_001"
down_revision: str | None = "add_projects_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _has_index(table: str, name: str) -> bool:
    return any(index.get("name") == name for index in sa.inspect(op.get_bind()).get_indexes(table))


def upgrade() -> None:
    if not _has_table("sync_tombstones"):
        op.create_table(
            "sync_tombstones",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("entity_type", sa.String(length=32), nullable=False),
            sa.Column("uid", sa.String(length=128), nullable=False),
            sa.Column("deleted_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "entity_type", "uid", name="uq_sync_tombstone_entity_uid"
            ),
        )
    if not _has_index("sync_tombstones", "ix_sync_tombstones_entity_type"):
        op.create_index(
            "ix_sync_tombstones_entity_type", "sync_tombstones", ["entity_type"]
        )
    if not _has_index("sync_tombstones", "ix_sync_tombstones_deleted_at"):
        op.create_index(
            "ix_sync_tombstones_deleted_at", "sync_tombstones", ["deleted_at"]
        )

    if not _has_table("sync_op_log"):
        op.create_table(
            "sync_op_log",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("client_id", sa.String(length=128), nullable=False),
            sa.Column("op_id", sa.String(length=128), nullable=False),
            sa.Column("result_json", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("client_id", "op_id", name="uq_sync_op_log_client_op"),
        )
    if not _has_index("sync_op_log", "ix_sync_op_log_client_id"):
        op.create_index("ix_sync_op_log_client_id", "sync_op_log", ["client_id"])
    if not _has_index("sync_op_log", "ix_sync_op_log_created_at"):
        op.create_index("ix_sync_op_log_created_at", "sync_op_log", ["created_at"])

    for table in ("todos", "journals", "habits"):
        index_name = f"ix_{table}_updated_at"
        if _has_table(table) and not _has_index(table, index_name):
            op.create_index(index_name, table, ["updated_at"])

    if _has_table("habit_records") and not _has_index(
        "habit_records", "uq_habit_record_date"
    ):
        # The old toggle endpoint could create duplicate day rows. Keep the
        # earliest durable record before enforcing set-state idempotency.
        op.execute(
            sa.text(
                "DELETE FROM habit_records "
                "WHERE id NOT IN ("
                "SELECT MIN(id) FROM habit_records GROUP BY habit_id, record_date"
                ")"
            )
        )
        op.create_index(
            "uq_habit_record_date",
            "habit_records",
            ["habit_id", "record_date"],
            unique=True,
        )


def downgrade() -> None:
    if _has_table("habit_records") and _has_index(
        "habit_records", "uq_habit_record_date"
    ):
        op.drop_index("uq_habit_record_date", table_name="habit_records")

    for table in ("habits", "journals", "todos"):
        index_name = f"ix_{table}_updated_at"
        if _has_table(table) and _has_index(table, index_name):
            op.drop_index(index_name, table_name=table)

    if _has_table("sync_op_log"):
        op.drop_table("sync_op_log")
    if _has_table("sync_tombstones"):
        op.drop_table("sync_tombstones")
