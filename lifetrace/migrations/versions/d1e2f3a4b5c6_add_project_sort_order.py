"""add_project_sort_order

Revision ID: d1e2f3a4b5c6
Revises: 4e5f6a7b8c9d
Create Date: 2026-08-19 12:00:00.000000

为 projects 表添加 sort_order 字段（侧边栏拖拽排序序号）。
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: str | Sequence[str] | None = "4e5f6a7b8c9d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()

    if "projects" not in existing_tables:
        return

    columns = {col["name"] for col in inspector.get_columns("projects")}
    if "sort_order" not in columns:
        op.add_column(
            "projects",
            sa.Column(
                "sort_order",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()

    if "projects" not in existing_tables:
        return

    columns = {col["name"] for col in inspector.get_columns("projects")}
    if "sort_order" in columns:
        op.drop_column("projects", "sort_order")
