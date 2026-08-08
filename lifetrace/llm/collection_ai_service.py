"""Collection AI 服务：摘要 + 推荐笔记。

仅辅助用户，不自动建立结构。同步调用 LLMClient（由 service 层包 asyncio.to_thread）。
无可用 LLM 时走 fallback。
"""

from __future__ import annotations

import json
import re
from typing import Any

from lifetrace.llm.llm_client import LLMClient
from lifetrace.util.logging_config import get_logger
from lifetrace.util.token_usage_logger import log_token_usage

logger = get_logger()

_PREVIEW_CHARS = 400
_MAX_NOTES_IN_PROMPT = 30


def _note_preview(note: dict[str, Any]) -> str:
    name = (note.get("name") or "").strip()
    body = (note.get("user_notes") or "").replace("\r", " ").replace("\n", " ").strip()
    body = body[:_PREVIEW_CHARS]
    return f"- [{note.get('id')}] {name}：{body}" if body else f"- [{note.get('id')}] {name}"


class CollectionAIService:
    """Collection 的 AI 摘要与推荐"""

    def __init__(self) -> None:
        self.llm_client = LLMClient()

    # ---- 摘要 ----

    def summarize(self, collection: dict[str, Any], notes: list[dict[str, Any]]) -> str:
        if not notes:
            return collection.get("description") or ""
        if not self.llm_client.is_available():
            logger.warning("LLM 不可用，使用 fallback 摘要")
            return self._fallback_summary(collection, notes)
        try:
            system = (
                "你是一个笔记整理助手。根据给定的笔记集合，生成一段凝练的摘要，"
                "概括这组笔记的共同主题与要点。只输出摘要正文，不要额外解释。"
            )
            user = self._build_summary_prompt(collection, notes)
            return self._call_llm(system, user, "summary") or self._fallback_summary(collection, notes)
        except Exception as exc:
            logger.error(f"Collection 摘要生成失败: {exc}", exc_info=True)
            return self._fallback_summary(collection, notes)

    def _build_summary_prompt(self, collection: dict[str, Any], notes: list[dict[str, Any]]) -> str:
        lines = "\n".join(_note_preview(n) for n in notes[:_MAX_NOTES_IN_PROMPT])
        return (
            f"集合名称：{collection.get('name', '')}\n"
            f"集合描述：{collection.get('description') or '（无）'}\n\n"
            f"集合内笔记：\n{lines}\n\n"
            "请生成一段 100~200 字的中文摘要。"
        )

    def _fallback_summary(self, collection: dict[str, Any], notes: list[dict[str, Any]]) -> str:
        names = "、".join((n.get("name") or "无题") for n in notes[:10])
        return f"本集合「{collection.get('name', '')}」共 {len(notes)} 条笔记：{names}。"

    # ---- 推荐 ----

    def recommend(
        self,
        collection: dict[str, Any],
        member_notes: list[dict[str, Any]],
        candidate_notes: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """返回推荐加入的候选笔记（dict: journal_id/name/reason）。不自动加入。"""
        if not candidate_notes:
            return []
        if not self.llm_client.is_available():
            logger.info("LLM 不可用，推荐跳过")
            return []
        try:
            system = (
                "你是笔记整理助手。根据集合的主题，从候选笔记中挑选最相关的若干条推荐加入。"
                "严格只输出 JSON 数组，不要 markdown 代码块，不要解释："
                '[{"id": 笔记id, "reason": "简短理由"}]'
            )
            user = self._build_recommend_prompt(collection, member_notes, candidate_notes)
            raw = self._call_llm(system, user, "recommend")
            return self._parse_recommend(raw, candidate_notes)
        except Exception as exc:
            logger.error(f"Collection 推荐生成失败: {exc}", exc_info=True)
            return []

    def _build_recommend_prompt(
        self,
        collection: dict[str, Any],
        member_notes: list[dict[str, Any]],
        candidate_notes: list[dict[str, Any]],
    ) -> str:
        member_lines = "\n".join(_note_preview(n) for n in member_notes[:_MAX_NOTES_IN_PROMPT])
        cand_lines = "\n".join(_note_preview(n) for n in candidate_notes[:_MAX_NOTES_IN_PROMPT])
        return (
            f"集合名称：{collection.get('name', '')}\n"
            f"集合描述：{collection.get('description') or '（无）'}\n\n"
            f"已有笔记：\n{member_lines or '（空）'}\n\n"
            f"候选笔记：\n{cand_lines}\n\n"
            "从候选笔记中挑选最多 8 条与该集合主题最相关的，输出 JSON 数组。"
        )

    def _parse_recommend(
        self, raw: str, candidate_notes: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        if not raw:
            return []
        # 去掉可能的 markdown 代码块
        text = raw.strip()
        text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"推荐结果 JSON 解析失败: {raw[:200]}")
            return []
        if not isinstance(data, list):
            return []
        valid_ids = {n["id"] for n in candidate_notes}
        name_map = {n["id"]: (n.get("name") or "") for n in candidate_notes}
        result: list[dict[str, Any]] = []
        seen: set[int] = set()
        for item in data:
            if not isinstance(item, dict):
                continue
            jid = item.get("id")
            if not isinstance(jid, int) or jid not in valid_ids or jid in seen:
                continue
            seen.add(jid)
            result.append(
                {
                    "journal_id": jid,
                    "name": name_map.get(jid, ""),
                    "reason": str(item.get("reason", ""))[:200],
                }
            )
        return result

    # ---- LLM 调用 ----

    def _call_llm(self, system_prompt: str, user_prompt: str, response_type: str) -> str:
        client = self.llm_client._get_client()
        response = client.chat.completions.create(
            model=self.llm_client.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=800,
        )
        if hasattr(response, "usage") and response.usage:
            log_token_usage(
                model=self.llm_client.model,
                input_tokens=response.usage.prompt_tokens,
                output_tokens=response.usage.completion_tokens,
                endpoint="collection_ai",
                response_type=response_type,
                feature_type="collection",
            )
        content = (response.choices[0].message.content or "").strip()
        return content


collection_ai_service = CollectionAIService()
