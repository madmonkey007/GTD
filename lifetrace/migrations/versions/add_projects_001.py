"""add_projects

Revision ID: add_projects_001
Revises: add_collections_001
Create Date: 2026-08-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'add_projects_001'
down_revision: Union[str, None] = 'add_collections_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _has_index(table: str, index_name: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return any(ix.get("name") == index_name for ix in insp.get_indexes(table))


def upgrade() -> None:
    # 幂等创建：表/索引已存在则跳过
    if not _has_table('projects'):
        op.create_table('projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('uid', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_image_url', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
    if _has_table('projects') and not _has_index('projects', 'ix_projects_uid'):
        with op.batch_alter_table('projects', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_projects_uid'), ['uid'], unique=False)

    # project_todo_relations
    if not _has_table('project_todo_relations'):
        op.create_table('project_todo_relations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('todo_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
    if _has_table('project_todo_relations'):
        with op.batch_alter_table('project_todo_relations', schema=None) as batch_op:
            if not _has_index('project_todo_relations', 'ix_project_todo_relations_project_id'):
                batch_op.create_index(batch_op.f('ix_project_todo_relations_project_id'), ['project_id'], unique=False)
            if not _has_index('project_todo_relations', 'ix_project_todo_relations_todo_id'):
                batch_op.create_index(batch_op.f('ix_project_todo_relations_todo_id'), ['todo_id'], unique=False)

    # project_note_relations
    if not _has_table('project_note_relations'):
        op.create_table('project_note_relations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('journal_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
    if _has_table('project_note_relations'):
        with op.batch_alter_table('project_note_relations', schema=None) as batch_op:
            if not _has_index('project_note_relations', 'ix_project_note_relations_project_id'):
                batch_op.create_index(batch_op.f('ix_project_note_relations_project_id'), ['project_id'], unique=False)
            if not _has_index('project_note_relations', 'ix_project_note_relations_journal_id'):
                batch_op.create_index(batch_op.f('ix_project_note_relations_journal_id'), ['journal_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    with op.batch_alter_table('project_note_relations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_project_note_relations_journal_id'))
        batch_op.drop_index(batch_op.f('ix_project_note_relations_project_id'))

    op.drop_table('project_note_relations')

    with op.batch_alter_table('project_todo_relations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_project_todo_relations_todo_id'))
        batch_op.drop_index(batch_op.f('ix_project_todo_relations_project_id'))

    op.drop_table('project_todo_relations')

    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_projects_uid'))

    op.drop_table('projects')
    # ### end Alembic commands ###
