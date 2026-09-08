"""add pinned to tags

Revision ID: tag_pinned_001
Revises: content_safety_001
Create Date: 2026-09-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "tag_pinned_001"
down_revision: str | None = "content_safety_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _tables(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    if "tags" in _tables(bind):
        cols = {c["name"] for c in sa.inspect(bind).get_columns("tags")}
        if "pinned" not in cols:
            op.add_column(
                "tags", sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false())
            )


def downgrade() -> None:
    bind = op.get_bind()
    if "tags" in _tables(bind):
        cols = {c["name"] for c in sa.inspect(bind).get_columns("tags")}
        if "pinned" in cols:
            op.drop_column("tags", "pinned")
