"""基于 SQLAlchemy 的 Collection 仓库实现

直接操作 db_base 会话，返回 dict 以避免 detached instance 问题
（与 sql_note_link_repository / journal_manager 风格一致）。
"""

from datetime import datetime
from typing import Any

from lifetrace.storage.database_base import DatabaseBase
from lifetrace.storage.models import Collection, CollectionNoteRelation
from lifetrace.util.logging_config import get_logger

logger = get_logger()


def _collection_to_dict(c: Collection, note_count: int = 0) -> dict[str, Any]:
    return {
        "id": c.id,
        "uid": c.uid,
        "name": c.name,
        "description": c.description,
        "cover_image_url": c.cover_image_url,
        "note_count": note_count,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


class SqlCollectionRepository:
    """基于 SQLAlchemy 的 Collection 仓库"""

    def __init__(self, db_base: DatabaseBase):
        self.db_base = db_base

    # ---- Collection CRUD ----

    def list_collections(self) -> list[dict[str, Any]]:
        with self.db_base.get_session() as session:
            rows = (
                session.query(Collection)
                .filter_by(deleted_at=None)
                .order_by(Collection.updated_at.desc())
                .all()
            )
            result = []
            for c in rows:
                count = (
                    session.query(CollectionNoteRelation)
                    .filter_by(collection_id=c.id, deleted_at=None)
                    .count()
                )
                result.append(_collection_to_dict(c, count))
            return result

    def get(self, collection_id: int) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            c = session.query(Collection).filter_by(id=collection_id, deleted_at=None).first()
            if not c:
                return None
            count = (
                session.query(CollectionNoteRelation)
                .filter_by(collection_id=c.id, deleted_at=None)
                .count()
            )
            return _collection_to_dict(c, count)

    def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        with self.db_base.get_session() as session:
            c = Collection(**fields)
            session.add(c)
            session.flush()
            result = _collection_to_dict(c, 0)
            session.commit()
            return result

    def update(self, collection_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            c = session.query(Collection).filter_by(id=collection_id, deleted_at=None).first()
            if not c:
                return None
            for key, value in fields.items():
                setattr(c, key, value)
            session.flush()
            count = (
                session.query(CollectionNoteRelation)
                .filter_by(collection_id=c.id, deleted_at=None)
                .count()
            )
            result = _collection_to_dict(c, count)
            session.commit()
            return result

    def soft_delete(self, collection_id: int) -> bool:
        with self.db_base.get_session() as session:
            c = session.query(Collection).filter_by(id=collection_id, deleted_at=None).first()
            if not c:
                return False
            c.deleted_at = datetime.utcnow()
            # 级联软删成员关系
            session.query(CollectionNoteRelation).filter_by(
                collection_id=collection_id, deleted_at=None
            ).update({CollectionNoteRelation.deleted_at: datetime.utcnow()}, synchronize_session=False)
            session.commit()
            return True

    # ---- 成员关系 ----

    def list_note_ids(self, collection_id: int) -> list[int]:
        with self.db_base.get_session() as session:
            rows = (
                session.query(CollectionNoteRelation.journal_id)
                .filter_by(collection_id=collection_id, deleted_at=None)
                .order_by(CollectionNoteRelation.created_at.asc())
                .all()
            )
            return [row[0] for row in rows]

    def add_notes(self, collection_id: int, journal_ids: list[int]) -> list[int]:
        """批量加入笔记（去重，返回新增的 journal_id 列表）"""
        if not journal_ids:
            return []
        with self.db_base.get_session() as session:
            existing = {
                row[0]
                for row in session.query(CollectionNoteRelation.journal_id).filter_by(
                    collection_id=collection_id, deleted_at=None
                ).all()
            }
            added: list[int] = []
            for jid in journal_ids:
                if jid in existing:
                    continue
                session.add(CollectionNoteRelation(collection_id=collection_id, journal_id=jid))
                existing.add(jid)
                added.append(jid)
            session.commit()
            return added

    def remove_note(self, collection_id: int, journal_id: int) -> bool:
        with self.db_base.get_session() as session:
            rel = (
                session.query(CollectionNoteRelation)
                .filter_by(collection_id=collection_id, journal_id=journal_id, deleted_at=None)
                .first()
            )
            if not rel:
                return False
            rel.deleted_at = datetime.utcnow()
            session.commit()
            return True

    def delete_by_journal(self, journal_id: int) -> int:
        """软删除涉及该笔记的所有集合成员关系（笔记删除时级联调用）"""
        with self.db_base.get_session() as session:
            count = (
                session.query(CollectionNoteRelation)
                .filter_by(journal_id=journal_id, deleted_at=None)
                .update({CollectionNoteRelation.deleted_at: datetime.utcnow()}, synchronize_session=False)
            )
            session.commit()
            return count
