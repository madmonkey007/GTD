"""add audio blob storage to cloud_transcription_tasks

云端语音转写不再依赖外部对象存储（Supabase）：录音字节直接存 Neon
（data bytea），转写时经带 HMAC 签名的短期公开 URL 供 DashScope 拉取。

Revision ID: cloud_audio_blob_001
Revises: tag_pinned_001
Create Date: 2026-09-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "cloud_audio_blob_001"
down_revision: str | None = "tag_pinned_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cloud_transcription_tasks",
        sa.Column("data", sa.LargeBinary(), nullable=True),
    )
    op.add_column(
        "cloud_transcription_tasks",
        sa.Column("content_type", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cloud_transcription_tasks", "content_type")
    op.drop_column("cloud_transcription_tasks", "data")
