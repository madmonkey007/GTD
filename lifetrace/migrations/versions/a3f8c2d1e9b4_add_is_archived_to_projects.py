"""Add is_archived to projects.

Revision ID: a3f8c2d1e9b4
Revises: 16edeb3bf089
Create Date: 2026-08-19 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a3f8c2d1e9b4"
down_revision: str | None = "16edeb3bf089"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "is_archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "is_archived")
