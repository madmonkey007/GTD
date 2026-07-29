"""基于 SQLAlchemy 的 NoteLink 仓库实现

直接操作 db_base 会话，返回 dict 以避免 detached instance 问题
（与 sql_habit_repository / journal_manager 风格一致）。
"""

from datetime import datetime
from typing import Any

from lifetrace.storage.database_base import DatabaseBase
from lifetrace.storage.models import NoteLink
from lifetrace.util.logging_config import get_logger

logger = get_logger()


def _link_to_dict(link: NoteLink) -> dict[str, Any]:
    return {
        "id": link.id,
        "source_note_id": link.source_note_id,
        "target_note_id": link.target_note_id,
        "relation_type": link.relation_type,
        "user_note": link.user_note,
        "created_at": link.created_at,
    }


class SqlNoteLinkRepository:
    """基于 SQLAlchemy 的 NoteLink 仓库"""

    def __init__(self, db_base: DatabaseBase):
        self.db_base = db_base

    def get_by_id(self, link_id: int) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            link = session.query(NoteLink).filter_by(id=link_id, deleted_at=None).first()
            return _link_to_dict(link) if link else None

    def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        with self.db_base.get_session() as session:
            link = NoteLink(**fields)
            session.add(link)
            session.flush()
            result = _link_to_dict(link)
            session.commit()
            return result

    def update(self, link_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            link = session.query(NoteLink).filter_by(id=link_id, deleted_at=None).first()
            if not link:
                return None
            for key, value in fields.items():
                setattr(link, key, value)
            session.flush()
            result = _link_to_dict(link)
            session.commit()
            return result

    def soft_delete(self, link_id: int) -> bool:
        with self.db_base.get_session() as session:
            link = session.query(NoteLink).filter_by(id=link_id, deleted_at=None).first()
            if not link:
                return False
            link.deleted_at = datetime.utcnow()
            session.commit()
            return True

    def list_outgoing(self, source_note_id: int) -> list[dict[str, Any]]:
        """以 source_note_id 为发出方的链接（我链接了谁）"""
        with self.db_base.get_session() as session:
            query = (
                session.query(NoteLink)
                .filter_by(source_note_id=source_note_id, deleted_at=None)
                .order_by(NoteLink.created_at.desc())
            )
            return [_link_to_dict(link) for link in query.all()]

    def list_incoming(self, target_note_id: int) -> list[dict[str, Any]]:
        """以 target_note_id 为指向方的链接（谁链接了我）"""
        with self.db_base.get_session() as session:
            query = (
                session.query(NoteLink)
                .filter_by(target_note_id=target_note_id, deleted_at=None)
                .order_by(NoteLink.created_at.desc())
            )
            return [_link_to_dict(link) for link in query.all()]

    def existing_target_ids(self, source_note_id: int) -> set[int]:
        """source 已链接的目标集合（用于候选去重）"""
        with self.db_base.get_session() as session:
            rows = (
                session.query(NoteLink.target_note_id)
                .filter_by(source_note_id=source_note_id, deleted_at=None)
                .all()
            )
            return {row[0] for row in rows}

    def delete_by_note(self, note_id: int) -> int:
        """软删除涉及该笔记的所有链接（作为源或目标），笔记删除时级联调用"""
        with self.db_base.get_session() as session:
            count = (
                session.query(NoteLink)
                .filter(
                    NoteLink.deleted_at.is_(None),
                    (NoteLink.source_note_id == note_id) | (NoteLink.target_note_id == note_id),
                )
                .update({NoteLink.deleted_at: datetime.utcnow()}, synchronize_session=False)
            )
            session.commit()
            return count
