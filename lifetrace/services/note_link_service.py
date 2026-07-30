"""笔记思想链接服务 - 业务逻辑层

提供有向、类型化笔记链接的 CRUD，以及基于相似度推荐的候选笔记。
候选复用 JournalService 同款的向量检索（search_similar_journals），不重写 embedding 逻辑。
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import HTTPException

from lifetrace.llm.vector_db import create_vector_db
from lifetrace.repositories.interfaces import IJournalRepository
from lifetrace.repositories.sql_note_link_repository import SqlNoteLinkRepository
from lifetrace.schemas.note_link import (
    LinkCandidate,
    NoteCounterpart,
    NoteLinkCreate,
    NoteLinkResponse,
    NoteLinkUpdate,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()

_VALID_RELATION = {"SUPPORTS", "EXTENDS", "CONTRADICTS", "RELATES"}


def _to_response(
    link: dict[str, Any], counterpart: dict[str, Any] | None = None
) -> NoteLinkResponse:
    cp = None
    if counterpart:
        preview = (
            (counterpart.get("user_notes") or "")
            .replace("\r", " ")
            .replace("\n", " ")
            .strip()[:150]
        )
        cp = NoteCounterpart(
            id=counterpart["id"],
            name=counterpart.get("name"),
            date=counterpart.get("date"),
            preview=preview,
        )
    return NoteLinkResponse(
        id=link["id"],
        source_note_id=link["source_note_id"],
        target_note_id=link["target_note_id"],
        relation_type=link["relation_type"],
        user_note=link.get("user_note"),
        created_at=link["created_at"],
        counterpart=cp,
    )


class NoteLinkService:
    """思想链接业务服务"""

    def __init__(
        self,
        repository: SqlNoteLinkRepository,
        journal_repository: IJournalRepository,
        db_base: Any = None,
    ):
        self.repository = repository
        self.journal_repository = journal_repository
        self.db_base = db_base
        # 复用与 JournalService 相同的向量库（语义检索候选笔记）
        self._vector_db = create_vector_db()
        if self._vector_db is None:
            logger.info("NoteLink 向量检索不可用（vector_db 未初始化），候选推荐将返回空")

    def _counterpart_for(self, note_id: int) -> dict[str, Any] | None:
        return self.journal_repository.get_by_id(note_id)

    # ---- CRUD ----

    def create_link(self, source_note_id: int, data: NoteLinkCreate) -> NoteLinkResponse:
        if data.relation_type not in _VALID_RELATION:
            raise HTTPException(status_code=422, detail=f"非法 relation_type: {data.relation_type}")
        if source_note_id == data.target_note_id:
            raise HTTPException(status_code=400, detail="不能链接自己")
        if not self.journal_repository.get_by_id(source_note_id):
            raise HTTPException(status_code=404, detail="源笔记不存在")
        target = self.journal_repository.get_by_id(data.target_note_id)
        if not target:
            raise HTTPException(status_code=404, detail="目标笔记不存在")

        # 唯一性：同源→同目标+同类型不重复（应用层校验，避免软删除冲突）
        for existing in self.repository.list_outgoing(source_note_id):
            if (
                existing["target_note_id"] == data.target_note_id
                and existing["relation_type"] == data.relation_type
            ):
                raise HTTPException(status_code=409, detail="该思想链接已存在")

        link = self.repository.create(
            {
                "source_note_id": source_note_id,
                "target_note_id": data.target_note_id,
                "relation_type": data.relation_type,
                "user_note": data.user_note,
            }
        )
        logger.info(
            f"创建思想链接 #{link['id']}: {source_note_id} -{data.relation_type}-> "
            f"{data.target_note_id}"
        )
        return _to_response(link, target)

    def update_link(self, link_id: int, data: NoteLinkUpdate) -> NoteLinkResponse:
        link = self.repository.get_by_id(link_id)
        if not link:
            raise HTTPException(status_code=404, detail="思想链接不存在")

        fields: dict[str, Any] = {}
        if data.relation_type is not None:
            if data.relation_type not in _VALID_RELATION:
                raise HTTPException(status_code=422, detail=f"非法 relation_type: {data.relation_type}")
            fields["relation_type"] = data.relation_type
        if data.user_note is not None:
            fields["user_note"] = data.user_note

        if not fields:
            return _to_response(link, self._counterpart_for(link["target_note_id"]))

        updated = self.repository.update(link_id, fields)
        return _to_response(updated, self._counterpart_for(updated["target_note_id"]))

    def delete_link(self, link_id: int) -> None:
        if not self.repository.soft_delete(link_id):
            raise HTTPException(status_code=404, detail="思想链接不存在")

    def list_links(self, note_id: int) -> dict[str, Any]:
        if not self.journal_repository.get_by_id(note_id):
            raise HTTPException(status_code=404, detail="笔记不存在")
        outgoing = [
            _to_response(link, self._counterpart_for(link["target_note_id"]))
            for link in self.repository.list_outgoing(note_id)
        ]
        incoming = [
            _to_response(link, self._counterpart_for(link["source_note_id"]))
            for link in self.repository.list_incoming(note_id)
        ]
        return {"outgoing": outgoing, "incoming": incoming}

    def delete_by_note(self, note_id: int) -> int:
        """笔记删除时级联清理（由 journal_service.delete_journal 调用）"""
        return self.repository.delete_by_note(note_id)

    # ---- 相似度候选（复用向量检索）----

    @staticmethod
    def _char_ngrams(text: str, n: int = 2) -> set[str]:
        """提取文本的字符 n-gram 集合（用于中文关键词重叠计算）

        用 n-gram 而非分词来捕捉中文关键词重叠，
        避免中文无空格分词导致 token 整体不匹配的问题。
        """
        clean = re.sub(r'[\s,，。！？、；：""''（）()\[\]【】《》/\-—…··#\d:]+', '', text)
        if len(clean) < n:
            return {clean} if clean else set()
        return {clean[i:i+n] for i in range(len(clean)-n+1)}

    @staticmethod
    def _keyword_overlap(a: str, b: str) -> float:
        """计算两段文本的字符 bigram 覆盖率，范围 [0, 1]

        使用不对称覆盖率（重叠数 / 较短文本的 n-gram 总数），
        比 Jaccard 更适合中文短文本关键词匹配——短文本只要
        大部分内容与查询重叠就能得到较高分数。
        """
        ta = NoteLinkService._char_ngrams(a, 2)
        tb = NoteLinkService._char_ngrams(b, 2)
        if not ta or not tb:
            return 0.0
        overlap = len(ta & tb)
        return overlap / min(len(ta), len(tb))


    def get_candidates(self, source_note_id: int, top_k: int = 10) -> list[LinkCandidate]:
        """以当前笔记做 embedding 查询，返回相似度最高的候选笔记列表（带 score）。

        使用混合评分：向量语义相似度（50%）+ 关键词重叠度（50%），
        弥补短文本或无标签笔记纯向量匹配不足的问题。

        检索量扩大到 top_k 的 8 倍，确保短文本笔记也能进入候选池，
        然后用关键词重叠度重新排序。
        """
        if self._vector_db is None:
            return []
        current = self.journal_repository.get_by_id(source_note_id)
        if not current:
            raise HTTPException(status_code=404, detail="笔记不存在")

        query_text = self._vector_db._build_journal_text(
            current.get("name", ""),
            current.get("user_notes", ""),
            current.get("tags", []),
        )
        if not query_text.strip():
            return []

        already_linked = self.repository.existing_target_ids(source_note_id)
        # 扩大检索范围到 8x，让短文本笔记也能进入候选池
        retrieve_k = max(80, top_k * 8 + len(already_linked) + 10)
        raw = self._vector_db.search_similar_journals(
            query_text=query_text,
            top_k=retrieve_k,
            exclude_journal_id=source_note_id,
        )
        if not raw:
            return []

        # 混合评分：50% 向量语义 + 50% 关键词重叠（bigram Jaccard）
        VEC_WEIGHT = 0.5
        KW_WEIGHT = 0.5

        candidates: list[LinkCandidate] = []
        for hit in raw:
            jid = hit.get("journal_id")
            if jid is None or jid in already_linked:
                continue
            note = self.journal_repository.get_by_id(jid)
            if not note:
                continue
            vec_score = float(hit.get("score", 0.0))
            candidate_text = (note.get("user_notes") or "") + " " + (note.get("name") or "")
            kw_score = self._keyword_overlap(query_text, candidate_text)
            final_score = VEC_WEIGHT * vec_score + KW_WEIGHT * kw_score

        candidates: list[LinkCandidate] = []
        for hit in raw:
            jid = hit.get("journal_id")
            if jid is None or jid in already_linked:
                continue
            note = self.journal_repository.get_by_id(jid)
            if not note:
                continue
            vec_score = float(hit.get("score", 0.0))
            candidate_text = (note.get("user_notes") or "") + " " + (note.get("name") or "")
            kw_score = self._keyword_overlap(query_text, candidate_text)
            final_score = VEC_WEIGHT * vec_score + KW_WEIGHT * kw_score

            preview = (
                (note.get("user_notes") or "").replace("\r", " ").replace("\n", " ").strip()
            )
            candidates.append(
                LinkCandidate(
                    id=note["id"],
                    name=note.get("name") or "",
                    preview=preview[:80],
                    score=round(final_score, 4),
                )
            )

        # 按混合分数重排序
        candidates.sort(key=lambda c: c.score, reverse=True)
        return candidates[:top_k]
