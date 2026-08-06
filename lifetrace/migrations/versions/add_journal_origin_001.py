"""add_journal_origin_001

Revision ID: add_journal_origin_001
Revises: 3b93a1943285
Create Date: 2026-08-06 09:00:00.000000

Add `origin` column to journals (manual / todo_background / todo_notes) and
`role` column to journal_todo_relations (background / notes / null) to support
bidirectional sync between todos and journal notes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_journal_origin_001"
down_revision: str | Sequence[str] | None = "3b93a1943285"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_column_if_missing(table: str, column: sa.Column, columns: set[str]) -> None:
    if column.name not in columns:
        op.add_column(table, column)


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()

    if "journals" in existing_tables:
        columns = {col["name"] for col in inspector.get_columns("journals")}
        _add_column_if_missing(
            "journals",
            sa.Column("origin", sa.String(length=20), nullable=False, server_default="manual"),
            columns,
        )
        # 建索引以便按来源筛选笔记列表
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("journals")}
        if "ix_journals_origin" not in existing_indexes:
            op.create_index("ix_journals_origin", "journals", ["origin"])

    if "journal_todo_relations" in existing_tables:
        columns = {col["name"] for col in inspector.get_columns("journal_todo_relations")}
        _add_column_if_missing(
            "journal_todo_relations",
            sa.Column("role", sa.String(length=20), nullable=True),
            columns,
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()

    if "journal_todo_relations" in existing_tables:
        columns = {col["name"] for col in inspector.get_columns("journal_todo_relations")}
        with op.batch_alter_table("journal_todo_relations", schema=None) as batch_op:
            if "role" in columns:
                batch_op.drop_column("role")

    if "journals" in existing_tables:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("journals")}
        if "ix_journals_origin" in existing_indexes:
            op.drop_index("ix_journals_origin", table_name="journals")
        columns = {col["name"] for col in inspector.get_columns("journals")}
        with op.batch_alter_table("journals", schema=None) as batch_op:
            if "origin" in columns:
                batch_op.drop_column("origin")
