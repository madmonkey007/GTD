"""add_is_inbox_to_todo

Revision ID: 16edeb3bf089
Revises: cf0bcf76731f
Create Date: 2026-08-18 19:07:17.672844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '16edeb3bf089'
down_revision: Union[str, None] = 'cf0bcf76731f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 新待办默认进收集箱；SQLite 中已有行回填为 True
    with op.batch_alter_table('todos', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('is_inbox', sa.Boolean(), nullable=False, server_default=sa.text('1'))
        )

    # 已归入项目的待办应移出收集箱
    op.execute(
        """
        UPDATE todos SET is_inbox = FALSE
        WHERE id IN (
            SELECT todo_id FROM project_todo_relations
            WHERE deleted_at IS NULL
        )
        """
    )


def downgrade() -> None:
    with op.batch_alter_table('todos', schema=None) as batch_op:
        batch_op.drop_column('is_inbox')
