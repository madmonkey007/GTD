"""Journal ↔ Todo 镜像笔记同步服务

负责把待办的「背景」和「备注」实时镜像为 Journal 笔记：

- 背景 (Todo.description) ↔ Journal(origin=todo_background, content_objective)
- 备注 (Todo.user_notes)  ↔ Journal(origin=todo_notes,     user_notes)

设计要点：
- upsert 按 (todo_id, origin) 唯一查找镜像笔记（应用层实现，SQLite 友好）。
- 正向同步由 todo_service.update_todo 触发，反向由 journal_service.update_journal 触发。
- 防递归：两个方向各自直接走底层 manager/repository，不回调对方的 service 层 hook。
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING

from lifetrace.schemas.journal import (
    ORIGIN_MANUAL,
    ORIGIN_TODO_BACKGROUND,
    ORIGIN_TODO_NOTES,
)
from lifetrace.storage.journal_manager import (
    JournalCreatePayload,
    JournalUpdatePayload,
    JournalManager,
)
from lifetrace.storage.models import Journal, JournalTodoRelation, Todo
from lifetrace.storage.sql_utils import col
from lifetrace.util.logging_config import get_logger
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()

if TYPE_CHECKING:
    from lifetrace.repositories.interfaces import ITodoRepository
    from lifetrace.storage.database_base import DatabaseBase

# 线程局部：标记当前正在由对端同步驱动，避免 service 层互相回调造成死循环
_sync_local = threading.local()


def _is_syncing_from_peer() -> bool:
    return bool(getattr(_sync_local, "syncing", False))


def _mark_syncing(value: bool) -> None:
    _sync_local.syncing = value


# origin → 待办字段映射
_ORIGIN_TO_TODO_FIELD: dict[str, str] = {
    ORIGIN_TODO_BACKGROUND: "description",
    ORIGIN_TODO_NOTES: "user_notes",
}

# origin → JournalTodoRelation.role
_ORIGIN_TO_ROLE: dict[str, str] = {
    ORIGIN_TODO_BACKGROUND: "background",
    ORIGIN_TODO_NOTES: "notes",
}


class JournalSyncService:
    """镜像笔记同步服务"""

    def __init__(self, db_base: DatabaseBase, todo_repository: ITodoRepository | None = None):
        self.db_base = db_base
        self.journal_manager = JournalManager(db_base)
        self.todo_repository = todo_repository

    # ===== 正向：待办 → 笔记 =====
    def sync_from_todo(
        self,
        todo_id: int,
        *,
        origin: str,
        content: str | None,
    ) -> int | None:
        """同步待办的某个字段到对应镜像笔记。

        Args:
            todo_id: 待办ID
            origin: todo_background / todo_notes
            content: 待办该字段的最新内容（description 或 user_notes）

        Returns:
            笔记ID，失败返回 None。content 为空则跳过创建。
        """
        if origin not in _ORIGIN_TO_TODO_FIELD:
            logger.warning(f"不支持的镜像 origin: {origin}")
            return None

        todo_snapshot = self._get_todo_snapshot(todo_id)
        if not todo_snapshot:
            return None

        text = (content or "").strip()
        journal_id = self._find_mirror_journal(todo_id, origin)

        # 已存在镜像笔记：内容为空则删除，否则更新
        if journal_id:
            if not text:
                self.journal_manager.delete_journal(journal_id)
                logger.info(f"镜像笔记已清空删除: journal={journal_id} origin={origin}")
                return None
            self._update_mirror(journal_id, origin, text, todo_snapshot)
            return journal_id

        # 不存在：空内容不创建
        if not text:
            return None
        return self._create_mirror(todo_id, origin, text, todo_snapshot)

    def _create_mirror(
        self,
        todo_id: int,
        origin: str,
        text: str,
        todo_snapshot: dict[str, Any],
    ) -> int | None:
        todo_name = todo_snapshot["display_name"]
        role = _ORIGIN_TO_ROLE[origin]
        now = get_utc_now()

        if origin == ORIGIN_TODO_BACKGROUND:
            name = f"背景 · {todo_name}"
            payload = JournalCreatePayload(
                name=name,
                user_notes=text,
                date=now,
                content_objective=text,
                origin=origin,
                related_todo_roles=[(todo_id, role)],
            )
        else:  # todo_notes
            name = f"备注 · {todo_name}"
            payload = JournalCreatePayload(
                name=name,
                user_notes=text,
                date=now,
                origin=origin,
                related_todo_roles=[(todo_id, role)],
            )

        journal_id = self.journal_manager.create_journal(payload)
        if journal_id:
            logger.info(
                f"创建镜像笔记: journal={journal_id} todo={todo_id} origin={origin}"
            )
        return journal_id

    def _update_mirror(
        self,
        journal_id: int,
        origin: str,
        text: str,
        todo_snapshot: dict[str, Any],
    ) -> None:
        todo_name = todo_snapshot["display_name"]
        prefix = "背景 · " if origin == ORIGIN_TODO_BACKGROUND else "备注 · "
        if origin == ORIGIN_TODO_BACKGROUND:
            payload = JournalUpdatePayload(
                name=f"{prefix}{todo_name}",
                content_objective=text,
                user_notes=text,
            )
        else:
            payload = JournalUpdatePayload(
                name=f"{prefix}{todo_name}",
                user_notes=text,
            )
        self.journal_manager.update_journal(journal_id, payload)

    # ===== 反向：笔记 → 待办 =====
    def sync_from_journal(self, journal_id: int) -> bool:
        """镜像笔记内容回写到待办对应字段。仅在 origin ∈ {todo_*} 时生效。"""
        journal_snapshot = self._get_journal_snapshot(journal_id)
        if not journal_snapshot:
            return False
        origin = journal_snapshot.get("origin") or ORIGIN_MANUAL
        if origin not in _ORIGIN_TO_TODO_FIELD:
            return False

        todo_id = self._find_todo_for_mirror(journal_id, origin)
        if not todo_id:
            logger.warning(f"镜像笔记找不到关联待办: journal={journal_id} origin={origin}")
            return False

        field = _ORIGIN_TO_TODO_FIELD[origin]
        text = (journal_snapshot.get("user_notes") or "").strip()
        if not self.todo_repository:
            logger.warning("JournalSyncService 未注入 todo_repository，无法反向回写")
            return False

        ok = self.todo_repository.update(todo_id, **{field: text or None})
        if ok:
            logger.info(f"镜像笔记回写待办: journal={journal_id} todo={todo_id} field={field}")
        return bool(ok)

    # ===== 清理：删待办时级联删镜像笔记 =====
    def cleanup_for_todo(self, todo_id: int) -> None:
        """删除该待办对应的两篇镜像笔记。"""
        for origin in (ORIGIN_TODO_BACKGROUND, ORIGIN_TODO_NOTES):
            journal_id = self._find_mirror_journal(todo_id, origin)
            if journal_id:
                self.journal_manager.delete_journal(journal_id)
                logger.info(
                    f"清理镜像笔记: journal={journal_id} todo={todo_id} origin={origin}"
                )

    # ===== 查询原语（直接走 session） =====
    def _find_mirror_journal(self, todo_id: int, origin: str) -> int | None:
        with self.db_base.get_session() as session:
            row = (
                session.query(Journal.id)
                .join(
                    JournalTodoRelation,
                    col(JournalTodoRelation.journal_id) == col(Journal.id),
                )
                .filter(col(JournalTodoRelation.todo_id) == todo_id)
                .filter(col(Journal.origin) == origin)
                .filter(col(Journal.deleted_at).is_(None))
                .filter(col(JournalTodoRelation.deleted_at).is_(None))
                .first()
            )
            return row[0] if row else None

    def _find_todo_for_mirror(self, journal_id: int, origin: str) -> int | None:
        with self.db_base.get_session() as session:
            row = (
                session.query(JournalTodoRelation.todo_id)
                .join(Journal, col(Journal.id) == col(JournalTodoRelation.journal_id))
                .filter(col(JournalTodoRelation.journal_id) == journal_id)
                .filter(col(Journal.origin) == origin)
                .filter(col(JournalTodoRelation.deleted_at).is_(None))
                .filter(col(Journal.deleted_at).is_(None))
                .first()
            )
            return row[0] if row else None

    def _get_journal_snapshot(self, journal_id: int) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            journal = (
                session.query(Journal)
                .filter(col(Journal.id) == journal_id)
                .filter(col(Journal.deleted_at).is_(None))
                .first()
            )
            if not journal:
                return None
            return {
                "id": journal.id,
                "origin": journal.origin,
                "user_notes": journal.user_notes,
            }

    def _get_todo_snapshot(self, todo_id: int) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            todo = session.query(Todo).filter(col(Todo.id) == todo_id).first()
            if not todo:
                return None
            return {
                "id": todo.id,
                "display_name": (todo.name or todo.summary or f"#{todo.id}").strip(),
            }
