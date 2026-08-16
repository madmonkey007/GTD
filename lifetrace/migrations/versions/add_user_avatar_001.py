"""add avatar columns to users

Revision ID: add_user_avatar_001
Revises: add_auth_users_002
Create Date: 2026-08-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_user_avatar_001"
down_revision: str | None = "add_auth_users_002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _columns(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    columns = _columns("users")
    with op.batch_alter_table("users") as batch:
        if "avatar_data" not in columns:
            batch.add_column(sa.Column("avatar_data", sa.LargeBinary(), nullable=True))
        if "avatar_mime" not in columns:
            batch.add_column(sa.Column("avatar_mime", sa.String(length=64), nullable=True))


def downgrade() -> None:
    columns = _columns("users")
    with op.batch_alter_table("users") as batch:
        if "avatar_mime" in columns:
            batch.drop_column("avatar_mime")
        if "avatar_data" in columns:
            batch.drop_column("avatar_data")
