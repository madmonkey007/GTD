"""基于 SQLAlchemy 的 Project 仓库实现

直接操作 db_base 会话，返回 dict 以避免 detached instance 问题
（与 sql_collection_repository 风格一致）。

独立关系表，不复用 JournalTodoRelation（避免被 origin/role 同步逻辑误触发）。
"""

from typing import Any

from lifetrace.storage.database_base import DatabaseBase
from lifetrace.storage.models import Project, ProjectNoteRelation, ProjectTodoRelation
from lifetrace.util.logging_config import get_logger
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()


def _project_to_dict(
    p: Project, todo_count: int = 0, note_count: int = 0
) -> dict[str, Any]:
    return {
        "id": p.id,
        "uid": p.uid,
        "name": p.name,
        "description": p.description,
        "cover_image_url": p.cover_image_url,
        "color": p.color,
        "todo_count": todo_count,
        "note_count": note_count,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


class SqlProjectRepository:
    """基于 SQLAlchemy 的 Project 仓库"""

    def __init__(self, db_base: DatabaseBase):
        self.db_base = db_base

    # ---- Project CRUD ----

    def list_projects(self) -> list[dict[str, Any]]:
        with self.db_base.get_session() as session:
            rows = (
                session.query(Project)
                .filter_by(deleted_at=None)
                .order_by(Project.updated_at.desc())
                .all()
            )
            result = []
            for p in rows:
                todo_count = (
                    session.query(ProjectTodoRelation)
                    .filter_by(project_id=p.id, deleted_at=None)
                    .count()
                )
                note_count = (
                    session.query(ProjectNoteRelation)
                    .filter_by(project_id=p.id, deleted_at=None)
                    .count()
                )
                result.append(_project_to_dict(p, todo_count, note_count))
            return result

    def get(self, project_id: int) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            p = session.query(Project).filter_by(id=project_id, deleted_at=None).first()
            if not p:
                return None
            todo_count = (
                session.query(ProjectTodoRelation)
                .filter_by(project_id=p.id, deleted_at=None)
                .count()
            )
            note_count = (
                session.query(ProjectNoteRelation)
                .filter_by(project_id=p.id, deleted_at=None)
                .count()
            )
            return _project_to_dict(p, todo_count, note_count)

    def get_by_uid(self, uid: str) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            project = session.query(Project).filter_by(uid=uid, deleted_at=None).first()
            return _project_to_dict(project) if project else None

    def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        with self.db_base.get_session() as session:
            p = Project(**fields)
            session.add(p)
            session.flush()
            result = _project_to_dict(p, 0, 0)
            session.commit()
            return result

    def update(self, project_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            p = session.query(Project).filter_by(id=project_id, deleted_at=None).first()
            if not p:
                return None
            for key, value in fields.items():
                setattr(p, key, value)
            session.flush()
            todo_count = (
                session.query(ProjectTodoRelation)
                .filter_by(project_id=p.id, deleted_at=None)
                .count()
            )
            note_count = (
                session.query(ProjectNoteRelation)
                .filter_by(project_id=p.id, deleted_at=None)
                .count()
            )
            result = _project_to_dict(p, todo_count, note_count)
            session.commit()
            return result

    def soft_delete(self, project_id: int) -> bool:
        with self.db_base.get_session() as session:
            p = session.query(Project).filter_by(id=project_id, deleted_at=None).first()
            if not p:
                return False
            now = get_utc_now()
            p.deleted_at = now
            # 级联软删成员关系
            session.query(ProjectTodoRelation).filter_by(
                project_id=project_id, deleted_at=None
            ).update({ProjectTodoRelation.deleted_at: now}, synchronize_session=False)
            session.query(ProjectNoteRelation).filter_by(
                project_id=project_id, deleted_at=None
            ).update({ProjectNoteRelation.deleted_at: now}, synchronize_session=False)
            session.commit()
            return True

    # ---- 待办成员 ----

    def list_todo_ids(self, project_id: int) -> list[int]:
        with self.db_base.get_session() as session:
            rows = (
                session.query(ProjectTodoRelation.todo_id)
                .filter_by(project_id=project_id, deleted_at=None)
                .order_by(ProjectTodoRelation.created_at.asc())
                .all()
            )
            return [row[0] for row in rows]

    def add_todos(self, project_id: int, todo_ids: list[int]) -> list[int]:
        if not todo_ids:
            return []
        with self.db_base.get_session() as session:
            existing = {
                row[0]
                for row in session.query(ProjectTodoRelation.todo_id).filter_by(
                    project_id=project_id, deleted_at=None
                ).all()
            }
            added: list[int] = []
            for tid in todo_ids:
                if tid in existing:
                    continue
                session.add(ProjectTodoRelation(project_id=project_id, todo_id=tid))
                existing.add(tid)
                added.append(tid)
            session.commit()
            return added

    def remove_todo(self, project_id: int, todo_id: int) -> bool:
        with self.db_base.get_session() as session:
            rel = (
                session.query(ProjectTodoRelation)
                .filter_by(project_id=project_id, todo_id=todo_id, deleted_at=None)
                .first()
            )
            if not rel:
                return False
            rel.deleted_at = get_utc_now()
            session.commit()
            return True

    # ---- 笔记成员 ----

    def list_note_ids(self, project_id: int) -> list[int]:
        with self.db_base.get_session() as session:
            rows = (
                session.query(ProjectNoteRelation.journal_id)
                .filter_by(project_id=project_id, deleted_at=None)
                .order_by(ProjectNoteRelation.created_at.asc())
                .all()
            )
            return [row[0] for row in rows]

    def add_notes(self, project_id: int, journal_ids: list[int]) -> list[int]:
        if not journal_ids:
            return []
        with self.db_base.get_session() as session:
            existing = {
                row[0]
                for row in session.query(ProjectNoteRelation.journal_id).filter_by(
                    project_id=project_id, deleted_at=None
                ).all()
            }
            added: list[int] = []
            for jid in journal_ids:
                if jid in existing:
                    continue
                session.add(ProjectNoteRelation(project_id=project_id, journal_id=jid))
                existing.add(jid)
                added.append(jid)
            session.commit()
            return added

    def remove_note(self, project_id: int, journal_id: int) -> bool:
        with self.db_base.get_session() as session:
            rel = (
                session.query(ProjectNoteRelation)
                .filter_by(project_id=project_id, journal_id=journal_id, deleted_at=None)
                .first()
            )
            if not rel:
                return False
            rel.deleted_at = get_utc_now()
            session.commit()
            return True

    # ---- 级联清理（实体删除时由 service 调用，预留）----

    def delete_by_todo(self, todo_id: int) -> int:
        with self.db_base.get_session() as session:
            count = (
                session.query(ProjectTodoRelation)
                .filter_by(todo_id=todo_id, deleted_at=None)
                .update({ProjectTodoRelation.deleted_at: get_utc_now()}, synchronize_session=False)
            )
            session.commit()
            return count

    def delete_by_journal(self, journal_id: int) -> int:
        with self.db_base.get_session() as session:
            count = (
                session.query(ProjectNoteRelation)
                .filter_by(journal_id=journal_id, deleted_at=None)
                .update({ProjectNoteRelation.deleted_at: get_utc_now()}, synchronize_session=False)
            )
            session.commit()
            return count
