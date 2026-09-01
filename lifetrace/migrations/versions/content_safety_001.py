"""add content safety tables (keyword_rules, content_violations)

Revision ID: content_safety_001
Revises: add_user_role_001
Create Date: 2026-09-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "content_safety_001"
down_revision: str | None = "add_user_role_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _tables(bind) -> set[str]:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    tables = _tables(op.get_bind())
    if "keyword_rules" not in tables:
        op.create_table(
            "keyword_rules",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("pattern", sa.String(length=500), nullable=False, index=True),
            sa.Column("is_regex", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("category", sa.String(length=32), nullable=False, server_default="custom", index=True),
            sa.Column("action", sa.String(length=16), nullable=False, server_default="flag"),
            sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true(), index=True),
            sa.Column("remark", sa.String(length=200), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if "content_violations" not in tables:
        op.create_table(
            "content_violations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False, index=True),
            sa.Column("resource_type", sa.String(length=32), nullable=False, index=True),
            sa.Column("resource_id", sa.Integer(), nullable=False, index=True),
            sa.Column("rule_id", sa.Integer(), nullable=False, index=True),
            sa.Column("rule_pattern", sa.String(length=500), nullable=False),
            sa.Column("matched_excerpt", sa.String(length=120), nullable=False),
            sa.Column("action_taken", sa.String(length=16), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="pending", index=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, index=True),
            sa.Column("resolved_at", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    tables = _tables(op.get_bind())
    if "content_violations" in tables:
        op.drop_table("content_violations")
    if "keyword_rules" in tables:
        op.drop_table("keyword_rules")
