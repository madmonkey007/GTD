"""Project 服务 - 业务逻辑层

CRUD + 双成员管理（待办/笔记）。本期不含 AI 摘要/推荐（预留扩展位）。
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import HTTPException

from lifetrace.schemas.project import (
    ProjectAddNotesRequest,
    ProjectAddTodosRequest,
    ProjectCreate,
    ProjectNoteItem,
    ProjectResponse,
    ProjectTodoItem,
    ProjectUpdate,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()

if TYPE_CHECKING:
    from lifetrace.repositories.interfaces import IJournalRepository, ITodoRepository
    from lifetrace.repositories.sql_project_repository import SqlProjectRepository


def _todo_to_preview(todo: dict[str, Any]) -> ProjectTodoItem:
    return ProjectTodoItem(
        id=todo["id"],
        name=todo.get("name"),
        status=todo.get("status"),
        start_time=todo.get("start_time"),
    )


def _note_to_preview(note: dict[str, Any]) -> ProjectNoteItem:
    preview = (note.get("user_notes") or "").replace("\r", " ").replace("\n", " ").strip()
    return ProjectNoteItem(
        id=note["id"],
        name=note.get("name"),
        date=note.get("date"),
        preview=preview[:150],
    )


def _to_response(
    p: dict[str, Any],
    todos: list[dict[str, Any]] | None = None,
    notes: list[dict[str, Any]] | None = None,
) -> ProjectResponse:
    return ProjectResponse(
        id=p["id"],
        uid=p["uid"],
        name=p["name"],
        description=p.get("description"),
        cover_image_url=p.get("cover_image_url"),
        color=p.get("color"),
        project_type=p.get("project_type", "project"),
        todo_count=p.get("todo_count", 0),
        note_count=p.get("note_count", 0),
        created_at=p["created_at"],
        updated_at=p["updated_at"],
        todos=[_todo_to_preview(t) for t in todos] if todos is not None else None,
        notes=[_note_to_preview(n) for n in notes] if notes is not None else None,
    )


class ProjectService:
    """Project 业务服务"""

    def __init__(
        self,
        repository: SqlProjectRepository,
        todo_repository: ITodoRepository,
        journal_repository: IJournalRepository,
    ):
        self.repository = repository
        self.todo_repository = todo_repository
        self.journal_repository = journal_repository

    # ---- 内部：拉取实体 dict ----

    def _fetch_todos(self, todo_ids: list[int]) -> list[dict[str, Any]]:
        todos: list[dict[str, Any]] = []
        for tid in todo_ids:
            t = self.todo_repository.get_by_id(tid)
            if t:
                todos.append(t)
        return todos

    def _fetch_notes(self, note_ids: list[int]) -> list[dict[str, Any]]:
        notes: list[dict[str, Any]] = []
        for jid in note_ids:
            n = self.journal_repository.get_by_id(jid)
            if n:
                notes.append(n)
        return notes

    # ---- Project CRUD ----

    def list_projects(self, project_type: str | None = None) -> list[ProjectResponse]:
        return [_to_response(p) for p in self.repository.list_projects(project_type)]

    def get_project(self, project_id: int) -> ProjectResponse:
        p = self.repository.get(project_id)
        if not p:
            raise HTTPException(status_code=404, detail="项目不存在")
        todos = self._fetch_todos(self.repository.list_todo_ids(project_id))
        notes = self._fetch_notes(self.repository.list_note_ids(project_id))
        return _to_response(p, todos, notes)

    def create_project(self, data: ProjectCreate) -> ProjectResponse:
        if not (data.name or "").strip():
            raise HTTPException(status_code=422, detail="项目名称不能为空")
        if data.uid:
            existing = self.repository.get_by_uid(data.uid)
            if existing:
                return _to_response(existing)
        if data.project_type not in ("project", "checklist"):
            raise HTTPException(status_code=422, detail="无效的项目类型")
        p = self.repository.create(
            {
                **({"uid": data.uid} if data.uid else {}),
                "name": data.name.strip(),
                "description": data.description,
                "cover_image_url": data.cover_image_url,
                "color": data.color,
                "project_type": data.project_type,
            }
        )
        logger.info(f"创建项目 #{p['id']}: {p['name']} (type={p['project_type']})")
        return _to_response(p)

    def update_project(self, project_id: int, data: ProjectUpdate) -> ProjectResponse:
        fields: dict[str, Any] = {}
        if data.name is not None:
            if not data.name.strip():
                raise HTTPException(status_code=422, detail="项目名称不能为空")
            fields["name"] = data.name.strip()
        if data.description is not None:
            fields["description"] = data.description
        if data.cover_image_url is not None:
            fields["cover_image_url"] = data.cover_image_url
        if data.color is not None:
            fields["color"] = data.color
        if data.project_type is not None:
            if data.project_type not in ("project", "checklist"):
                raise HTTPException(status_code=422, detail="无效的项目类型")
            fields["project_type"] = data.project_type
        p = self.repository.update(project_id, fields)
        if not p:
            raise HTTPException(status_code=404, detail="项目不存在")
        return _to_response(p)

    def delete_project(self, project_id: int) -> None:
        if not self.repository.soft_delete(project_id):
            raise HTTPException(status_code=404, detail="项目不存在")

    # ---- 待办成员 ----

    def add_todos(self, project_id: int, data: ProjectAddTodosRequest) -> ProjectResponse:
        if not self.repository.get(project_id):
            raise HTTPException(status_code=404, detail="项目不存在")
        valid_ids = [tid for tid in data.todo_ids if self.todo_repository.get_by_id(tid)]
        self.repository.add_todos(project_id, valid_ids)
        # 归入项目后移出收集箱
        for tid in valid_ids:
            self.todo_repository.update(tid, is_inbox=False)
        return self.get_project(project_id)

    def remove_todo(self, project_id: int, todo_id: int) -> ProjectResponse:
        if not self.repository.get(project_id):
            raise HTTPException(status_code=404, detail="项目不存在")
        self.repository.remove_todo(project_id, todo_id)
        # 从项目移除后回到收集箱
        self.todo_repository.update(todo_id, is_inbox=True)
        return self.get_project(project_id)

    # ---- 笔记成员 ----

    def _require_project_not_checklist(self, project_id: int) -> dict[str, Any]:
        """检查项目非 checklist 类型，否则笔记操作拒绝"""
        p = self.repository.get(project_id)
        if not p:
            raise HTTPException(status_code=404, detail="项目不存在")
        if p.get("project_type") == "checklist":
            raise HTTPException(status_code=400, detail="清单类型不支持笔记操作")
        return p

    def add_notes(self, project_id: int, data: ProjectAddNotesRequest) -> ProjectResponse:
        self._require_project_not_checklist(project_id)
        valid_ids = [jid for jid in data.journal_ids if self.journal_repository.get_by_id(jid)]
        self.repository.add_notes(project_id, valid_ids)
        return self.get_project(project_id)

    def remove_note(self, project_id: int, journal_id: int) -> ProjectResponse:
        self._require_project_not_checklist(project_id)
        self.repository.remove_note(project_id, journal_id)
        return self.get_project(project_id)

    # ---- 级联清理（实体删除时调用）----

    def delete_by_todo(self, todo_id: int) -> int:
        return self.repository.delete_by_todo(todo_id)

    def delete_by_journal(self, journal_id: int) -> int:
        return self.repository.delete_by_journal(journal_id)
