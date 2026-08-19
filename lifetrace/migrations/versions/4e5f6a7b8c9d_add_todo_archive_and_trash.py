"""add_todo_archive_and_trash

Revision ID: 4e5f6a7b8c9d
Revises: a3f8c2d1e9b4
Create Date: 2026-08-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e5f6a7b8c9d'
down_revision: Union[str, None] = 'a3f8c2d1e9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 待办：归档字段 + 回收站字段（软删除标记 + 入站时间）
    with op.batch_alter_table('todos', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(
            sa.Column("is_trashed", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(sa.Column("trashed_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('todos', schema=None) as batch_op:
        batch_op.drop_column('trashed_at')
        batch_op.drop_column('is_trashed')
        batch_op.drop_column('is_archived')
