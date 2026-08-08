"""Collection 服务 - 业务逻辑层

CRUD + 成员管理 + AI 摘要/推荐。AI 同步调用通过 asyncio.to_thread 包裹，
避免阻塞事件循环（与 audio_extraction_service 一致）。
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from fastapi import HTTPException

from lifetrace.llm.collection_ai_service import collection_ai_service
from lifetrace.repositories.interfaces import IJournalRepository
from lifetrace.repositories.sql_collection_repository import SqlCollectionRepository
from lifetrace.schemas.collection import (
    CollectionAddNotesRequest,
    CollectionCreate,
    CollectionNote,
    CollectionRecommendItem,
    CollectionResponse,
    CollectionSummaryResponse,
    CollectionUpdate,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()

_MAX_CANDIDATES = 60


def _note_to_preview(note: dict[str, Any]) -> CollectionNote:
    preview = (note.get("user_notes") or "").replace("\r", " ").replace("\n", " ").strip()
    return CollectionNote(
        id=note["id"],
        name=note.get("name"),
        date=note.get("date"),
        preview=preview[:150],
    )


def _to_response(
    c: dict[str, Any], notes: list[dict[str, Any]] | None = None
) -> CollectionResponse:
    return CollectionResponse(
        id=c["id"],
        uid=c["uid"],
        name=c["name"],
        description=c.get("description"),
        cover_image_url=c.get("cover_image_url"),
        note_count=c.get("note_count", 0),
        created_at=c["created_at"],
        updated_at=c["updated_at"],
        notes=[_note_to_preview(n) for n in notes] if notes is not None else None,
    )


class CollectionService:
    """Collection 业务服务"""

    def __init__(
        self,
        repository: SqlCollectionRepository,
        journal_repository: IJournalRepository,
    ):
        self.repository = repository
        self.journal_repository = journal_repository

    # ---- 内部：拉取笔记 dict ----

    def _fetch_notes(self, note_ids: list[int]) -> list[dict[str, Any]]:
        notes: list[dict[str, Any]] = []
        for jid in note_ids:
            n = self.journal_repository.get_by_id(jid)
            if n:
                notes.append(n)
        return notes

    # ---- Collection CRUD ----

    def list_collections(self) -> list[CollectionResponse]:
        return [_to_response(c) for c in self.repository.list_collections()]

    def get_collection(self, collection_id: int) -> CollectionResponse:
        c = self.repository.get(collection_id)
        if not c:
            raise HTTPException(status_code=404, detail="集合不存在")
        note_ids = self.repository.list_note_ids(collection_id)
        notes = self._fetch_notes(note_ids)
        return _to_response(c, notes)

    def create_collection(self, data: CollectionCreate) -> CollectionResponse:
        if not (data.name or "").strip():
            raise HTTPException(status_code=422, detail="集合名称不能为空")
        c = self.repository.create(
            {
                "name": data.name.strip(),
                "description": data.description,
                "cover_image_url": data.cover_image_url,
            }
        )
        logger.info(f"创建集合 #{c['id']}: {c['name']}")
        return _to_response(c, [])

    def update_collection(self, collection_id: int, data: CollectionUpdate) -> CollectionResponse:
        fields: dict[str, Any] = {}
        if data.name is not None:
            if not data.name.strip():
                raise HTTPException(status_code=422, detail="集合名称不能为空")
            fields["name"] = data.name.strip()
        if data.description is not None:
            fields["description"] = data.description
        if data.cover_image_url is not None:
            fields["cover_image_url"] = data.cover_image_url
        c = self.repository.update(collection_id, fields)
        if not c:
            raise HTTPException(status_code=404, detail="集合不存在")
        return _to_response(c)

    def delete_collection(self, collection_id: int) -> None:
        if not self.repository.soft_delete(collection_id):
            raise HTTPException(status_code=404, detail="集合不存在")

    # ---- 成员管理 ----

    def add_notes(self, collection_id: int, data: CollectionAddNotesRequest) -> CollectionResponse:
        if not self.repository.get(collection_id):
            raise HTTPException(status_code=404, detail="集合不存在")
        # 校验笔记存在
        valid_ids = [jid for jid in data.journal_ids if self.journal_repository.get_by_id(jid)]
        self.repository.add_notes(collection_id, valid_ids)
        return self.get_collection(collection_id)

    def remove_note(self, collection_id: int, journal_id: int) -> CollectionResponse:
        if not self.repository.get(collection_id):
            raise HTTPException(status_code=404, detail="集合不存在")
        self.repository.remove_note(collection_id, journal_id)
        return self.get_collection(collection_id)

    def delete_by_journal(self, journal_id: int) -> int:
        """笔记删除时级联清理（由 journal_service.delete_journal 调用）"""
        return self.repository.delete_by_journal(journal_id)

    # ---- AI ----

    async def summarize(self, collection_id: int) -> CollectionSummaryResponse:
        c = self.repository.get(collection_id)
        if not c:
            raise HTTPException(status_code=404, detail="集合不存在")
        notes = self._fetch_notes(self.repository.list_note_ids(collection_id))
        summary = await asyncio.to_thread(collection_ai_service.summarize, c, notes)
        return CollectionSummaryResponse(summary=summary)

    async def recommend(self, collection_id: int) -> list[CollectionRecommendItem]:
        c = self.repository.get(collection_id)
        if not c:
            raise HTTPException(status_code=404, detail="集合不存在")
        member_ids = set(self.repository.list_note_ids(collection_id))
        # 候选 = 最近笔记中尚未加入的
        all_notes = self.journal_repository.list_journals(
            limit=_MAX_CANDIDATES, offset=0, start_date=None, end_date=None, search=None
        )
        candidates = [n for n in all_notes if n["id"] not in member_ids]
        member_notes = self._fetch_notes(list(member_ids))
        items = await asyncio.to_thread(
            collection_ai_service.recommend, c, member_notes, candidates
        )
        return [CollectionRecommendItem(**item) for item in items]
