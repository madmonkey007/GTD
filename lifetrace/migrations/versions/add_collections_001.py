"""add_collections

Revision ID: add_collections_001
Revises: add_journal_origin_001
Create Date: 2026-08-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'add_collections_001'
down_revision: Union[str, None] = 'add_journal_origin_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _has_index(table: str, index_name: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return any(ix.get("name") == index_name for ix in insp.get_indexes(table))


def upgrade() -> None:
    # 幂等创建：表/索引已存在则跳过
    if not _has_table('collections'):
        op.create_table('collections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('uid', sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_image_url', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
    if _has_table('collections') and not _has_index('collections', 'ix_collections_uid'):
        with op.batch_alter_table('collections', schema=None) as batch_op:
            batch_op.create_index(batch_op.f('ix_collections_uid'), ['uid'], unique=False)

    if not _has_table('collection_note_relations'):
        op.create_table('collection_note_relations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('collection_id', sa.Integer(), nullable=False),
        sa.Column('journal_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
    if _has_table('collection_note_relations'):
        with op.batch_alter_table('collection_note_relations', schema=None) as batch_op:
            if not _has_index('collection_note_relations', 'ix_collection_note_relations_collection_id'):
                batch_op.create_index(batch_op.f('ix_collection_note_relations_collection_id'), ['collection_id'], unique=False)
            if not _has_index('collection_note_relations', 'ix_collection_note_relations_journal_id'):
                batch_op.create_index(batch_op.f('ix_collection_note_relations_journal_id'), ['journal_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    with op.batch_alter_table('collection_note_relations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_collection_note_relations_journal_id'))
        batch_op.drop_index(batch_op.f('ix_collection_note_relations_collection_id'))

    op.drop_table('collection_note_relations')
    with op.batch_alter_table('collections', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_collections_uid'))

    op.drop_table('collections')
    # ### end Alembic commands ###
