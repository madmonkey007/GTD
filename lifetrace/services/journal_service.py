"""Journal 业务逻辑层

处理 Journal 相关的业务逻辑，与数据访问层解耦。
"""

from __future__ import annotations

import re
import threading
from datetime import datetime, time, timedelta
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException
from sqlalchemy import or_

from lifetrace.llm.journal_generation_service import journal_generation_service
from lifetrace.llm.vector_db import create_vector_db
from lifetrace.schemas.journal import (
    JournalAutoLinkCandidate,
    JournalAutoLinkRequest,
    JournalAutoLinkResponse,
    JournalCreate,
    JournalGenerateRequest,
    JournalGenerateResponse,
    JournalListResponse,
    JournalResponse,
    JournalUpdate,
)
from lifetrace.storage.journal_manager import JournalCreatePayload, JournalUpdatePayload
from lifetrace.storage.models import Activity, Todo
from lifetrace.storage.sql_utils import col
from lifetrace.util.logging_config import get_logger

logger = get_logger()

if TYPE_CHECKING:
    from collections.abc import Callable

    from lifetrace.repositories.interfaces import IJournalRepository
    from lifetrace.storage.database_base import DatabaseBase

_DEFAULT_BUCKET_START = time(hour=4, minute=0)


class JournalService:
    """Journal 业务逻辑层"""

    def __init__(self, repository: IJournalRepository, db_base: DatabaseBase):
        self.repository = repository
        self.db_base = db_base
        # 向量库（用于笔记语义检索，可能为 None）
        self._vector_db = create_vector_db()
        if self._vector_db is None:
            logger.info("Journal 向量检索不可用（vector_db 未初始化）")

    def _normalize_name(self, name: str | None) -> str:
        cleaned = (name or "").strip()
        return cleaned or "Untitled"

    def _index_journal(
        self,
        journal_id: int,
        name: str,
        user_notes: str,
        tags: list[str] | None,
    ) -> None:
        """把笔记写入向量库（失败只记日志，不抛异常）"""
        if self._vector_db is None:
            return
        try:
            self._vector_db.upsert_journal(journal_id, name or "", user_notes or "", tags)
        except Exception as e:
            logger.warning(f"索引笔记 {journal_id} 到向量库失败: {e}")

    def _index_journal_async(
        self,
        journal_id: int,
        name: str,
        user_notes: str,
        tags: list[str] | None,
    ) -> None:
        """后台线程索引笔记，不阻塞主请求（embedding API 较慢，约 1-2s）

        笔记创建/更新立即返回，索引在后台完成后写入向量库。
        """
        if self._vector_db is None:
            return

        def _run() -> None:
            try:
                self._vector_db.upsert_journal(journal_id, name or "", user_notes or "", tags)
            except Exception as e:
                logger.warning(f"后台索引笔记 {journal_id} 到向量库失败: {e}")

        # 复制 tags 避免线程间共享可变对象
        tags_copy = list(tags) if tags else None
        thread = threading.Thread(
            target=_run,
            args=(journal_id, name, user_notes, tags_copy),
            daemon=True,
        )
        thread.start()

    def get_insight_context(
        self,
        journal_id: int,
        similar_count: int = 4,
        cross_domain_count: int = 2,
        similar_min_score: float = 0.95,
        cross_domain_range: tuple[float, float] = (0.45, 0.58),
    ) -> dict[str, Any]:
        """获取洞察上下文：当前笔记 + 相似笔记 + 跨域笔记

        取数逻辑：
        - 第一层（相似）：用当前笔记做 embedding 查询，取相似度最高的 N 条，
          排除相似度过高的（>similar_min_score，基本是重复笔记）
        - 第二层（跨域）：从相似度中等区间随机抽取 M 条，
          这个区间的笔记有一点关联但不是同一话题

        Args:
            journal_id: 当前笔记 ID
            similar_count: 相似层取数数量
            cross_domain_count: 跨域层取数数量
            similar_min_score: 相似度高于此值视为重复，排除
            cross_domain_range: 跨域层的相似度区间 (low, high)

        Returns:
            {"current": {...}, "similar": [...], "cross_domain": [...]}
        """
        current = self.repository.get_by_id(journal_id)
        if not current:
            raise HTTPException(status_code=404, detail="笔记不存在")

        result: dict[str, Any] = {
            "current": current,
            "similar": [],
            "cross_domain": [],
        }

        if self._vector_db is None:
            logger.warning("向量库不可用，无法获取相似/跨域笔记")
            return result

        # 构建查询文本（标题 + 标签 + 正文）
        query_text = self._vector_db._build_journal_text(
            current.get("name", ""),
            current.get("user_notes", ""),
            current.get("tags", []),
        )
        if not query_text.strip():
            return result

        # 检索（多取一些用于分层）
        retrieve_k = max(50, similar_count + cross_domain_count + 10)
        raw = self._vector_db.search_similar_journals(
            query_text=query_text,
            top_k=retrieve_k,
            exclude_journal_id=journal_id,
        )
        if not raw:
            return result

        # 第一层：相似（score <= similar_min_score，按 score 降序取前 N）
        similar_pool = [r for r in raw if r["score"] <= similar_min_score]
        similar_sorted = sorted(similar_pool, key=lambda x: x["score"], reverse=True)
        similar_hits = similar_sorted[:similar_count]
        similar_ids = [r["journal_id"] for r in similar_hits if r["journal_id"] is not None]

        # 第二层：跨域（score 在 cross_domain_range 内，随机取 M 条）
        low, high = cross_domain_range
        cross_pool = [r for r in raw if low <= r["score"] <= high]
        # 排除已选入相似层的
        cross_pool = [r for r in cross_pool if r["journal_id"] not in similar_ids]
        # 随机抽取（数量不足就全给）
        import random as _random

        _random.shuffle(cross_pool)
        cross_hits = cross_pool[:cross_domain_count]
        cross_ids = [r["journal_id"] for r in cross_hits if r["journal_id"] is not None]

        # 批量取笔记详情
        all_ids = similar_ids + cross_ids
        if all_ids:
            details = {d["id"]: d for d in self._get_journals_by_ids(all_ids)}
            result["similar"] = [details[i] for i in similar_ids if i in details]
            result["cross_domain"] = [details[i] for i in cross_ids if i in details]

        return result

    def _get_journals_by_ids(self, journal_ids: list[int]) -> list[dict[str, Any]]:
        """按 ID 批量获取笔记（复用 repository 的 list，再过滤）"""
        if not journal_ids:
            return []
        # repository 没有按 ids 批量查的接口，用 list_journals 取较大集合后过滤
        id_set = set(journal_ids)
        # 取一个足够大的 limit 覆盖目标笔记
        all_journals = self.repository.list_journals(
            limit=max(500, len(journal_ids) * 5),
            offset=0,
            start_date=None,
            end_date=None,
            search=None,
        )
        return [j for j in all_journals if j.get("id") in id_set]

    def _resolve_day_bucket_range(
        self, date: datetime, day_bucket_start: datetime | None
    ) -> tuple[datetime, datetime]:
        bucket_time = (day_bucket_start or date).time()
        if day_bucket_start is None:
            bucket_time = _DEFAULT_BUCKET_START

        bucket_start = datetime.combine(date.date(), bucket_time, tzinfo=date.tzinfo)
        if date < bucket_start:
            bucket_start -= timedelta(days=1)
        bucket_end = bucket_start + timedelta(days=1)
        return bucket_start, bucket_end

    def _extract_keywords(self, text: str) -> list[str]:
        if not text:
            return []
        normalized = text.lower()
        english = re.findall(r"[a-z0-9][a-z0-9_-]{1,}", normalized)
        chinese = re.findall(r"[\u4e00-\u9fff]{2,}", text)
        return sorted(set(english + chinese))

    def _score_text(self, text: str, keywords: list[str]) -> float:
        if not text or not keywords:
            return 0.0
        lowered = text.lower()
        score = sum(1 for keyword in keywords if keyword in lowered)
        return float(score)

    def _score_candidates(
        self,
        items: list[dict[str, Any]],
        keywords: list[str],
        text_builder: Callable[[dict[str, Any]], str],
    ) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        for item in items:
            text = text_builder(item)
            score = self._score_text(text, keywords)
            if score <= 0:
                continue
            candidates.append(
                {
                    "id": item["id"],
                    "name": item.get("name") or item.get("title") or "",
                    "score": score,
                }
            )
        candidates.sort(key=lambda item: (-item["score"], item["id"]))
        return candidates

    def _list_todos_for_range(self, start: datetime, end: datetime) -> list[dict[str, Any]]:
        with self.db_base.get_session() as session:
            query = session.query(Todo).filter(col(Todo.deleted_at).is_(None))
            query = query.filter(
                or_(
                    col(Todo.start_time).between(start, end),
                    col(Todo.end_time).between(start, end),
                    col(Todo.deadline).between(start, end),
                    col(Todo.created_at).between(start, end),
                )
            )
            todos = query.order_by(col(Todo.created_at).desc()).all()
            return [
                {
                    "id": todo.id,
                    "name": todo.name,
                    "description": todo.description,
                    "user_notes": todo.user_notes,
                    "status": todo.status,
                    "deadline": todo.deadline,
                    "start_time": todo.start_time,
                    "end_time": todo.end_time,
                }
                for todo in todos
            ]

    def _list_activities_for_range(self, start: datetime, end: datetime) -> list[dict[str, Any]]:
        with self.db_base.get_session() as session:
            query = (
                session.query(Activity)
                .filter(col(Activity.deleted_at).is_(None))
                .filter(col(Activity.start_time) >= start)
                .filter(col(Activity.start_time) <= end)
            )
            activities = query.order_by(col(Activity.start_time).desc()).all()
            return [
                {
                    "id": activity.id,
                    "title": activity.ai_title or "",
                    "summary": activity.ai_summary or "",
                    "start_time": activity.start_time,
                    "end_time": activity.end_time,
                }
                for activity in activities
            ]

    def _resolve_generation_context(
        self, payload: JournalGenerateRequest
    ) -> tuple[dict[str, Any] | None, datetime, str, str, datetime | None]:
        journal = None
        if payload.journal_id is not None:
            journal = self.repository.get_by_id(payload.journal_id)
            if not journal:
                raise HTTPException(status_code=404, detail="日记不存在")

        date = payload.date or (journal.get("date") if journal else None)
        if date is None:
            raise HTTPException(status_code=400, detail="缺少日记日期")

        title = payload.title or (journal.get("name") if journal else "") or ""
        content_original = (
            payload.content_original
            if payload.content_original is not None
            else (journal.get("user_notes") if journal else "")
        )
        content_original = content_original or ""
        day_bucket_start = payload.day_bucket_start or (
            journal.get("day_bucket_start") if journal else None
        )
        return journal, date, title, content_original, day_bucket_start

    def get_journal(self, journal_id: int) -> JournalResponse:
        """获取单个日记"""
        journal = self.repository.get_by_id(journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="日记不存在")
        return JournalResponse(**journal)

    def list_journals(
        self,
        limit: int,
        offset: int,
        start_date: datetime | None,
        end_date: datetime | None,
        search: str | None = None,
    ) -> JournalListResponse:
        """获取日记列表"""
        journals = self.repository.list_journals(limit, offset, start_date, end_date, search=search)
        total = self.repository.count(start_date, end_date, search=search)
        return JournalListResponse(
            total=total,
            journals=[JournalResponse(**j) for j in journals],
        )

    def create_journal(self, data: JournalCreate) -> JournalResponse:
        """创建日记"""
        payload = JournalCreatePayload(
            uid=data.uid,
            name=self._normalize_name(data.name),
            user_notes=data.user_notes,
            date=data.date,
            content_format=data.content_format or "markdown",
            content_objective=data.content_objective,
            content_ai=data.content_ai,
            mood=data.mood,
            energy=data.energy,
            day_bucket_start=data.day_bucket_start,
            tags=data.tags,
            related_todo_ids=data.related_todo_ids,
            related_activity_ids=data.related_activity_ids,
            related_note_ids=data.related_note_ids,
        )
        journal_id = self.repository.create(payload)
        if not journal_id:
            raise HTTPException(status_code=500, detail="创建日记失败")

        # 写入向量库（后台异步，不阻塞主请求）
        self._index_journal_async(journal_id, payload.name, payload.user_notes, data.tags)

        logger.info(f"成功创建日记: {journal_id} - {payload.name}")
        return self.get_journal(journal_id)

    def _build_update_payload(self, data: JournalUpdate) -> JournalUpdatePayload:
        update_data = data.model_dump(exclude_none=True)
        if "name" in update_data:
            update_data["name"] = self._normalize_name(update_data["name"])
        return JournalUpdatePayload(**update_data)

    def update_journal(self, journal_id: int, data: JournalUpdate) -> JournalResponse:
        """更新日记"""
        if not self.repository.get_by_id(journal_id):
            raise HTTPException(status_code=404, detail="日记不存在")

        payload = self._build_update_payload(data)

        if not self.repository.update(journal_id, payload):
            raise HTTPException(status_code=500, detail="更新日记失败")

        # 更新向量库（后台异步，用最新内容重建索引）
        updated = self.repository.get_by_id(journal_id)
        if updated:
            self._index_journal_async(
                journal_id,
                updated.get("name", ""),
                updated.get("user_notes", ""),
                updated.get("tags", []),
            )

        logger.info(f"成功更新日记: {journal_id}")
        return self.get_journal(journal_id)

    def delete_journal(self, journal_id: int) -> None:
        """删除日记"""
        if not self.repository.get_by_id(journal_id):
            raise HTTPException(status_code=404, detail="日记不存在")
        if not self.repository.delete(journal_id):
            raise HTTPException(status_code=500, detail="删除日记失败")

        # 从向量库删除
        if self._vector_db is not None:
            self._vector_db.delete_journal(journal_id)

        logger.info(f"成功删除日记: {journal_id}")

    def auto_link(self, payload: JournalAutoLinkRequest) -> JournalAutoLinkResponse:
        journal = None
        if payload.journal_id is not None:
            journal = self.repository.get_by_id(payload.journal_id)
            if not journal:
                raise HTTPException(status_code=404, detail="日记不存在")

        title = payload.title or (journal.get("name") if journal else "") or ""
        content_original = (
            payload.content_original
            if payload.content_original is not None
            else (journal.get("user_notes") if journal else "")
        )
        day_bucket_start = payload.day_bucket_start or (
            journal.get("day_bucket_start") if journal else None
        )

        start_time, end_time = self._resolve_day_bucket_range(payload.date, day_bucket_start)
        todos = self._list_todos_for_range(start_time, end_time)
        activities = self._list_activities_for_range(start_time, end_time)

        keywords = self._extract_keywords(f"{title} {content_original}")
        todo_candidates = self._score_candidates(
            todos,
            keywords,
            lambda item: " ".join(
                filter(None, [item.get("name"), item.get("description"), item.get("user_notes")])
            ),
        )
        activity_candidates = self._score_candidates(
            activities,
            keywords,
            lambda item: " ".join(filter(None, [item.get("title"), item.get("summary")])),
        )

        related_todo_ids = [c["id"] for c in todo_candidates[: payload.max_items]]
        related_activity_ids = [c["id"] for c in activity_candidates[: payload.max_items]]

        if payload.journal_id is not None:
            update_payload = JournalUpdatePayload(
                related_todo_ids=related_todo_ids,
                related_activity_ids=related_activity_ids,
            )
            self.repository.update(payload.journal_id, update_payload)

        return JournalAutoLinkResponse(
            related_todo_ids=related_todo_ids,
            related_activity_ids=related_activity_ids,
            todo_candidates=[JournalAutoLinkCandidate(**c) for c in todo_candidates],
            activity_candidates=[JournalAutoLinkCandidate(**c) for c in activity_candidates],
        )

    def generate_objective(self, payload: JournalGenerateRequest) -> JournalGenerateResponse:
        journal, date, _title, content_original, day_bucket_start = (
            self._resolve_generation_context(payload)
        )
        start_time, end_time = self._resolve_day_bucket_range(date, day_bucket_start)
        todos = self._list_todos_for_range(start_time, end_time)
        activities = self._list_activities_for_range(start_time, end_time)

        content = journal_generation_service.generate_objective(
            activities=activities,
            todos=todos,
            language=payload.language,
        )

        if journal:
            update_payload = JournalUpdatePayload(content_objective=content)
            self.repository.update(journal["id"], update_payload)

        return JournalGenerateResponse(content=content)

    def generate_ai_view(self, payload: JournalGenerateRequest) -> JournalGenerateResponse:
        journal, date, title, content_original, day_bucket_start = self._resolve_generation_context(
            payload
        )
        start_time, end_time = self._resolve_day_bucket_range(date, day_bucket_start)
        todos = self._list_todos_for_range(start_time, end_time)
        activities = self._list_activities_for_range(start_time, end_time)

        content = journal_generation_service.generate_ai_view(
            title=title,
            content_original=content_original,
            activities=activities,
            todos=todos,
            language=payload.language,
        )

        if journal:
            update_payload = JournalUpdatePayload(content_ai=content)
            self.repository.update(journal["id"], update_payload)

        return JournalGenerateResponse(content=content)
