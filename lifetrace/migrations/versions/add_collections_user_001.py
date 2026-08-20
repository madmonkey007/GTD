"""add user_id to collections for per-user isolation

Revision ID: add_collections_user_001
Revises: d1e2f3a4b5c6
Create Date: 2026-08-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "add_collections_user_001"
down_revision: str | None = "d1e2f3a4b5c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table in inspector.get_table_names() and any(
        col["name"] == column for col in inspector.get_columns(table)
    )


def _has_index(table: str, name: str) -> bool:
    return any(
        index.get("name") == name for index in sa.inspect(op.get_bind()).get_indexes(table)
    )


def upgrade() -> None:
    if not _has_column("collections", "user_id"):
        op.add_column("collections", sa.Column("user_id", sa.Integer(), nullable=True))
        # 回填存量归属：集合本质是用户笔记的歌单，取拥有最多笔记的非 bootstrap
        # 真实用户作为存量属主（单人部署场景下即唯一真实账户）；无任何用户时回退 1
        bind = op.get_bind()
        owner = bind.execute(
            sa.text(
                "SELECT j.user_id FROM journals j JOIN users u ON u.id = j.user_id "
                "WHERE u.email != 'bootstrap@lifetrace.local' "
                "GROUP BY j.user_id ORDER BY COUNT(*) DESC LIMIT 1"
            )
        ).scalar()
        owner = owner if owner is not None else 1
        bind.execute(
            sa.text("UPDATE collections SET user_id = :owner WHERE user_id IS NULL"),
            {"owner": owner},
        )
    if not _has_index("collections", "ix_collections_user_id"):
        op.create_index("ix_collections_user_id", "collections", ["user_id"])
    if not _has_index("collections", "ix_collections_user_id_uid"):
        op.create_index(
            "ix_collections_user_id_uid", "collections", ["user_id", "uid"]
        )


def downgrade() -> None:
    if _has_index("collections", "ix_collections_user_id_uid"):
        op.drop_index("ix_collections_user_id_uid", table_name="collections")
    if _has_index("collections", "ix_collections_user_id"):
        op.drop_index("ix_collections_user_id", table_name="collections")
    if _has_column("collections", "user_id"):
        op.drop_column("collections", "user_id")
