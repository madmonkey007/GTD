"""Add project_type to projects.

Revision ID: cf0bcf76731f
Revises: add_user_avatar_001
Create Date: 2026-08-18 14:10:19.140422
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "cf0bcf76731f"
down_revision: str | None = "add_user_avatar_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add only the field represented by this migration."""
    op.add_column(
        "projects",
        sa.Column(
            "project_type",
            sa.String(length=20),
            nullable=False,
            server_default="project",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "project_type")
