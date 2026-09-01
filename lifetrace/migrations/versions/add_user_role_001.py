"""add role to users

Revision ID: add_user_role_001
Revises: add_collections_user_001
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_user_role_001"
down_revision: str | None = "add_collections_user_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    columns = _columns("users")
    with op.batch_alter_table("users") as batch:
        if "role" not in columns:
            batch.add_column(
                sa.Column("role", sa.String(length=20), nullable=False, server_default="user")
            )


def downgrade() -> None:
    columns = _columns("users")
    with op.batch_alter_table("users") as batch:
        if "role" in columns:
            batch.drop_column("role")
