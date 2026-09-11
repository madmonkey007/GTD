"""Journal 业务逻辑层

处理 Journal 相关的业务逻辑，与数据访问层解耦。
"""

from __future__ import annotations

import os
import re
from contextvars import ContextVar
from datetime import datetime, time, timedelta
from inspect import Parameter, signature
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException
from sqlalchemy import or_

from lifetrace.llm.journal_generation_service import journal_generation_service
from lifetrace.llm.vector_db import create_vector_db
from lifetrace.schemas.journal import (
    TODO_ORIGINS,
    JournalAutoLinkCandidate,
    JournalAutoLinkRequest,
    JournalAutoLinkResponse,
    JournalCreate,
    JournalGenerateRequest,
    JournalGenerateResponse,
    JournalListResponse,
    JournalLite,
    JournalLiteListResponse,
    JournalResponse,
    JournalUpdate,
)
from lifetrace.services.journal_sync_service import (
    _is_syncing_from_peer as _is_peer_sync,
)
from lifetrace.services.journal_sync_service import (
    _mark_syncing,
)
from lifetrace.storage.journal_manager import (
    _UNSET,
    JournalCreatePayload,
    JournalManager,
    JournalUpdatePayload,
)
from lifetrace.storage.models import Activity, Todo
from lifetrace.storage.sql_utils import col
from lifetrace.util.base_paths import get_user_config_dir
from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings
from lifetrace.util.time_utils import now_local_naive, to_local_naive

logger = get_logger()


# 同步推送/脚本批量写入时跳过 AI 标题生成（免费小模型限流，批量会拖慢 push）
_skip_ai_title = ContextVar("skip_ai_title", default=False)


def run_without_ai_title(func, *args, **kwargs):
    """在跳过 AI 标题生成的上下文中执行（离线同步批量推送时使用）。"""
    token = _skip_ai_title.set(True)
    try:
        return func(*args, **kwargs)
    finally:
        _skip_ai_title.reset(token)

if TYPE_CHECKING:
    from collections.abc import Callable

    from lifetrace.repositories.interfaces import IJournalRepository, ITodoRepository
    from lifetrace.storage.database_base import DatabaseBase

_DEFAULT_BUCKET_START = time(hour=4, minute=0)


class JournalService:
    """Journal 业务逻辑层"""

    def __init__(
        self,
        repository: IJournalRepository,
        db_base: DatabaseBase,
        todo_repository: ITodoRepository | None = None,
    ):
        self.repository = repository
        self.db_base = db_base
        self.user_id = int(getattr(repository, "user_id", 1))
        self.journal_manager = JournalManager(db_base, user_id=self.user_id)
        # 向量库（用于笔记语义检索，可能为 None）
        vector_factory_params = signature(create_vector_db).parameters
        self._vector_db = create_vector_db(db_base) if vector_factory_params else create_vector_db()
        if self._vector_db is None:
            logger.info("Journal 向量检索不可用（vector_db 未初始化）")
        # 镜像笔记回写待办的同步服务（反向同步）
        self._sync_service = None
        if todo_repository is not None:
            try:
                from lifetrace.services.journal_sync_service import JournalSyncService

                self._sync_service = JournalSyncService(db_base, todo_repository=todo_repository)
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"JournalSyncService 初始化失败，反向同步禁用: {exc}")
                self._sync_service = None

    def _normalize_name(self, name: str | None, fallback_time: datetime | None = None) -> str:
        cleaned = (name or "").strip()
        if cleaned:
            return cleaned
        if fallback_time:
            return fallback_time.strftime("%Y-%m-%d %H:%M")
        return "Untitled"

    # 时间型伪标题（后端 _normalize_name 的兜底值）——只有这种标题才允许 AI 生成覆盖。
    # 兼容老数据：完整「YYYY-MM-DD HH:MM」与纯「HH:MM(:SS)」都视为伪标题
    _AUTO_TITLE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}|\d{1,2}:\d{2}(:\d{2})?)$")
    def _is_auto_title(self, name: str | None) -> bool:
        """标题是否为伪标题（空 / Untitled / 时间兜底）。"""
        cleaned = (name or "").strip()
        return not cleaned or cleaned == "Untitled" or bool(self._AUTO_TITLE_RE.match(cleaned))

    def _get_title_channels(self) -> list[dict[str, str]]:
        """读取标题专用通道；云端默认复用已配置的 DashScope 密钥。"""
        channels: list[dict[str, str]] = []
        try:
            import yaml

            # 统一用用户数据目录（--data-dir 指定）读取，开发/打包/设置页三处一致。
            # 此前用 Path(__file__) 在 PyInstaller 打包下解析到 _internal 内不存在的
            # config.yaml，导致标题生成通道永远读不到配置。
            cfg_path = get_user_config_dir() / "config.yaml"
            if cfg_path.exists():
                with cfg_path.open(encoding="utf-8") as config_file:
                    cfg_all = yaml.safe_load(config_file) or {}
                found_title_channel = False
                for section in ("title_llm", "title_llm_fallback"):
                    channel = cfg_all.get(section)
                    if channel and channel.get("api_key"):
                        channels.append(channel)
                        found_title_channel = True
                # 未单独配置标题模型时，回退复用主 LLM 配置，避免重复维护。
                if not found_title_channel:
                    main_llm = cfg_all.get("llm") or {}
                    if main_llm.get("api_key"):
                        channels.append(
                            {
                                "api_key": main_llm["api_key"],
                                "base_url": main_llm.get("base_url"),
                                "model": main_llm.get("model"),
                            }
                        )
        except Exception as exc:
            logger.warning(f"读取标题模型配置失败: {exc}")

        dashscope_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
        if dashscope_key:
            channels.append(
                {
                    "api_key": dashscope_key,
                    "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    "model": "qwen-turbo",
                }
            )
        llm_key = str(getattr(settings.llm, "api_key", "") or "").strip()
        if llm_key and llm_key not in {
            "xxx",
            "YOUR_API_KEY_HERE",
            "YOUR_LLM_KEY_HERE",
        }:
            generic_channel = {
                "api_key": llm_key,
                "base_url": str(settings.llm.base_url),
                "model": str(settings.llm.model),
            }
            if generic_channel not in channels:
                channels.append(generic_channel)
        return channels

    def _request_ai_title(self, content: str | None) -> str:
        """调用标题专用模型并返回清洗后的完整标题。"""
        if _skip_ai_title.get():
            return ""
        text = (content or "").strip()
        if not text:
            return ""
        try:
            messages = [
                {
                    "role": "system",
                    "content": (
                        "为笔记生成一个简短、自然、便于以后识别内容的标题。\n\n"
                        "优先保留原文的关键概念和表达，不要美化、升华或写成文章标题。\n\n"
                        "只输出标题。\n"
                        "要求：中文（除非笔记明显是其他语言）；不超过 10 个字，宁可短不可长；"
                        "概括核心内容；不加引号、不加书名号、冒号，不以标点结尾。\n\n"
                        "反向案例\n"
                        "-矛盾论：普遍性规律与特殊问题\n"
                        "-专注力提升法：一次一任务\n"
                        "-XX之道\n\n"
                        "正向案例\n"
                        "-一次只做一件事\n"
                        "-矛盾的普遍性与特殊性\n"
                        "-周末出海站分享启发"
                    ),
                },
                {"role": "user", "content": text[:1500]},
            ]
            raw = ""
            from openai import OpenAI as _OpenAI

            for channel in self._get_title_channels():
                try:
                    title_client = _OpenAI(
                        base_url=channel["base_url"],
                        api_key=channel["api_key"],
                        timeout=20,
                    )
                    extra = (
                        {"reasoning_effort": "none"}
                        if "agnes" in channel.get("model", "")
                        else None
                    )
                    kwargs = {
                        "model": channel["model"],
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 50,
                    }
                    if extra:
                        kwargs["extra_body"] = extra  # type: ignore[assignment]
                    response = title_client.chat.completions.create(**kwargs)  # type: ignore[arg-type]
                    raw = response.choices[0].message.content or ""
                except Exception as exc:
                    logger.warning(
                        f"标题生成通道失败 ({channel.get('model')}): {exc}"
                    )
                if raw.strip():
                    break
            title = (raw or "").strip().splitlines()[0].strip().strip('"“”').strip() if raw and raw.strip() else ""
            # 模型不总是遵守「不加冒号」：程序级兜底，禁用符号替换为空格
            title = re.sub(r"[：:，,；;·|｜]", " ", title)
            title = re.sub(r"\s+", " ", title).strip()
            if not title or len(title) > 20 or self._is_auto_title(title):
                return ""
            return title
        except Exception as exc:  # 生成失败不影响笔记保存
            logger.warning(f"AI 标题生成失败（保留原伪标题）: {exc}")
            return ""

    def generate_ai_title(self, journal_id: int) -> JournalResponse:
        """为伪标题笔记生成标题；正文保存路径不等待本方法。"""
        existing = self.repository.get_by_id(journal_id)
        if not existing:
            raise HTTPException(status_code=404, detail="日记不存在")
        expected_name = (existing.get("name") or "").strip()
        if not self._is_auto_title(expected_name) or not (
            existing.get("user_notes") or ""
        ).strip():
            return JournalResponse(**existing)

        title = self._request_ai_title(existing.get("user_notes"))
        if title and self.repository.update_title_if_unchanged(
            journal_id, expected_name, title
        ):
            logger.info(f"AI 生成笔记标题: {journal_id} -> {title}")
        latest = self.repository.get_by_id(journal_id)
        if not latest:
            raise HTTPException(status_code=404, detail="日记不存在")
        return JournalResponse(**latest)

    @staticmethod
    def _auto_extract_tags(content: str | None) -> list[str]:
        """从正文中提取 #标签 格式的标签。"""
        if not content:
            return []
        matches = re.findall(r'#([^\s#]+)(?:\s|$)', content)
        seen: set[str] = set()
        result: list[str] = []
        for tag in matches:
            tag = tag.strip()
            if tag and tag not in seen:
                seen.add(tag)
                result.append(tag)
        return result

    @staticmethod
    def _ensure_tags_in_content(content: str | None, tags: list[str] | None) -> str:
        """确保 tags 中的每个标签都以 #标签 形式存在于正文中。

        已通过 #tag 语法存在于正文中的标签不重复追加。
        正文为空且 tags 有值时直接返回 #标签行。
        前端的 extractTagsFromUserNotes 提取 #tag，
        编辑保存时也只从正文 #tag 提取，所以标签必须在正文中才可见可编辑。
        """
        if not tags:
            return content or ""
        existing = set(JournalService._auto_extract_tags(content))
        needed = [t for t in tags if t not in existing]
        if not needed:
            return content or ""
        tag_line = " ".join(f"#{t}" for t in needed)
        base = (content or "").strip()
        return base + "\n\n" + tag_line if base else tag_line

    @staticmethod
    def _accepts_user_scope(method: object, desktop_arg_count: int) -> bool:
        """Return whether a bound vector method has the extra cloud user argument."""
        positional = [
            parameter
            for parameter in signature(method).parameters.values()
            if parameter.kind
            in (Parameter.POSITIONAL_ONLY, Parameter.POSITIONAL_OR_KEYWORD)
        ]
        return len(positional) > desktop_arg_count

    def _index_journal(
        self,
        journal_id: int,
        name: str,
        user_notes: str,
        tags: list[str] | None,
    ) -> None:
        """把笔记写入向量库

        云端 PostgreSQL 向量库（propagate_index_errors=True）失败时抛出异常，
        让同步接口返回可重试错误；桌面 ChromaDB 路径只记日志，不阻断保存。
        """
        if self._vector_db is None:
            return
        try:
            # 两个后端签名不同：PostgresCloudVectorDB 多一个 user_id，本地 Chroma 不带。
            # 按参数数量判断，避免装饰器或测试替身的参数名变化破坏分派。
            if self._accepts_user_scope(self._vector_db.upsert_journal, 4):
                self._vector_db.upsert_journal(self.user_id, journal_id, name or "", user_notes or "", tags)
            else:
                self._vector_db.upsert_journal(journal_id, name or "", user_notes or "", tags)
        except Exception as e:
            if getattr(self._vector_db, "propagate_index_errors", False):
                raise RuntimeError(f"索引笔记 {journal_id} 到云端向量库失败: {e}") from e
            logger.warning(f"索引笔记 {journal_id} 到向量库失败: {e}")

    def _remove_journal_index(self, journal_id: int) -> None:
        """从向量库删除笔记索引（失败处理策略同 _index_journal）"""
        if self._vector_db is None:
            return
        try:
            if self._accepts_user_scope(self._vector_db.delete_journal, 1):
                self._vector_db.delete_journal(self.user_id, journal_id)
            else:
                self._vector_db.delete_journal(journal_id)
        except Exception as e:
            if getattr(self._vector_db, "propagate_index_errors", False):
                raise RuntimeError(f"从云端向量库删除笔记 {journal_id} 索引失败: {e}") from e
            logger.warning(f"从向量库删除笔记 {journal_id} 索引失败: {e}")

    def _index_journal_async(
        self,
        journal_id: int,
        name: str,
        user_notes: str,
        tags: list[str] | None,
    ) -> None:
        """索引笔记；云端 PostgreSQL 写入必须在请求生命周期内完成。"""
        if self._vector_db is None:
            return

        self._index_journal(journal_id, name, user_notes, tags)

    def ensure_journal_index(self, journal_id: int) -> None:
        """用已保存的笔记内容补建云端向量索引。"""
        journal = self.repository.get_by_id(journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="日记不存在")
        self._index_journal_async(
            journal_id,
            journal.get("name", ""),
            journal.get("user_notes", ""),
            journal.get("tags", []),
        )

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
            user_id=self.user_id,
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

    def rename_tag(self, tag_name: str, new_name: str) -> dict[str, Any]:
        """重命名标签（全局）：更新标签实体并同步所有笔记正文中的 #tag 文本"""
        tag_name = (tag_name or "").strip()
        new_name = (new_name or "").strip()
        if not tag_name:
            raise HTTPException(status_code=400, detail="缺少标签名称")
        if not new_name:
            raise HTTPException(status_code=400, detail="标签名称不能为空")
        affected = self._journals_with_tag(tag_name)
        result = self.journal_manager.rename_tag_by_name(tag_name, new_name)
        if result is None:
            raise HTTPException(status_code=404, detail="标签不存在")
        if affected:
            self._sync_tag_text(affected)
        tag_id, final_name = result
        return {"id": tag_id, "tag_name": final_name}

    def delete_tag(self, tag_name: str) -> list[int]:
        """删除标签（全局）：移除所有笔记的关联并清理正文中的 #tag 文本"""
        tag_name = (tag_name or "").strip()
        if not tag_name:
            raise HTTPException(status_code=400, detail="缺少标签名称")
        affected = self._journals_with_tag(tag_name)
        removed = self.journal_manager.delete_tag_by_name(tag_name)
        if not removed:
            return []
        self._sync_tag_text(affected)
        return affected

    def set_tag_pinned(self, tag_name: str, pinned: bool) -> dict[str, Any]:
        """设置标签置顶（全局状态，存于 Tag 实体）"""
        tag_name = (tag_name or "").strip()
        if not tag_name:
            raise HTTPException(status_code=400, detail="缺少标签名称")
        if not self.journal_manager.set_tag_pinned(tag_name, pinned):
            raise HTTPException(status_code=404, detail="标签不存在")
        return {"tag_name": tag_name, "pinned": pinned}

    def get_pinned_tags(self) -> list[str]:
        """置顶标签名列表"""
        return sorted(self.journal_manager.get_pinned_tags())

    def _journals_with_tag(self, tag_name: str) -> list[int]:
        """列出带指定标签的全部笔记ID（受影响集合需在删除前取好）"""
        ids: list[int] = []
        offset = 0
        while True:
            batch = self.journal_manager.list_journals(
                limit=200, offset=offset, start_date=None, end_date=None
            )
            for j in batch:
                if any(t.get("tag_name") == tag_name for t in j.get("tags", [])):
                    ids.append(j["id"])
            if len(batch) < 200:
                break
            offset += 200
        return ids

    def _sync_tag_text(self, journal_ids: list[int]) -> None:
        """标签改名/删除后，按笔记最新标签列表重写正文 #tag 文本并重建向量索引。

        对每条受影响笔记：剔除正文里已无对应标签实体的 #tag（删除/改名旧名），
        再把标签列表中缺失的 #标签 补进正文（改名合并到新名）。
        """
        try:
            for journal_id in dict.fromkeys(journal_ids):
                current = self.journal_manager.get_journal(journal_id)
                if not current:
                    continue
                notes = current.get("user_notes") or ""
                tag_names = [t["tag_name"] for t in current.get("tags", [])]
                extracted = self._auto_extract_tags(notes)
                updated = notes
                for t in extracted:
                    if t not in tag_names:
                        updated = re.sub(
                            rf"(^|\s)#{re.escape(t)}(?=\s|[，。；！？,.;!?]|$)",
                            r"\1",
                            updated,
                        )
                if tag_names:
                    updated = self._ensure_tags_in_content(updated, tag_names)
                if updated != notes:
                    self.journal_manager.update_journal(
                        journal_id,
                        JournalUpdatePayload(user_notes=updated),
                    )
                self._index_journal_async(
                    journal_id,
                    current.get("name", ""),
                    updated,
                    tag_names,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"同步标签正文文本失败: {exc}")

    def list_journals(
        self,
        limit: int,
        offset: int,
        start_date: datetime | None,
        end_date: datetime | None,
        search: str | None = None,
        origin: str | None = None,
        origins: str | None = None,
    ) -> JournalListResponse:
        """获取日记列表"""
        # origin/origins 归一为 origins 列表
        origins_list: list[str] | None = None
        if origins:
            origins_list = [s.strip() for s in origins.split(",") if s.strip()]
        elif origin:
            origins_list = [origin]

        # 优先走 manager（支持 origins 过滤）；repository 抽象暂未透传 origins
        journals = self.journal_manager.list_journals(
            limit=limit,
            offset=offset,
            start_date=start_date,
            end_date=end_date,
            search=search,
            origins=origins_list,
        )
        total = self.journal_manager.count_journals(
            start_date=start_date,
            end_date=end_date,
            search=search,
            origins=origins_list,
        )
        return JournalListResponse(
            total=total,
            journals=[JournalResponse(**j) for j in journals],
        )

    def list_journal_lites(
        self,
        limit: int = 1000,
        offset: int = 0,
        start_date=None,
        end_date=None,
    ) -> JournalLiteListResponse:
        """轻量列出日记：只含 id/name/date/created_at/user_notes，无 N+1 序列化"""
        rows = self.repository.list_lites(limit, offset, start_date, end_date)
        total = self.repository.count(start_date, end_date)
        return JournalLiteListResponse(
            total=total,
            notes=[JournalLite(**r) for r in rows],
        )

    def create_journal(self, data: JournalCreate) -> JournalResponse:
        """创建日记"""
        # uid 幂等：客户端重试/双击携带同一 uid 时复用已落库的笔记，防止重复创建
        if data.uid:
            existing = self.repository.get_by_uid(data.uid)
            if existing:
                return JournalResponse(**existing)
        # 自动提取标签：从正文中提取 #标签 语法
        tags = data.tags
        if not tags and data.user_notes:
            auto_tags = self._auto_extract_tags(data.user_notes)
            if auto_tags:
                tags = auto_tags
        # 确保标签以 #标签 形式存在于正文中（编辑时才可见可改）
        user_notes = self._ensure_tags_in_content(data.user_notes, tags)
        # 日期归一为「配置时区的本地墙上时间」：journals.date 全库此语义，
        # aware 输入（如带 Z 的 ISO）转配置时区；服务器时区不可靠（Vercel 为 UTC）
        note_date = to_local_naive(data.date)
        # 日期补全时间：前端 date-only 输入会被解析为午夜 00:00:00，
        # 这里用配置时区当前时间填充（保留年月日），使新笔记按 date DESC 排序时
        # 能排在当天已有笔记之上（与 chat create_note 工具行为一致）。
        if (
            note_date.hour == 0
            and note_date.minute == 0
            and note_date.second == 0
            and note_date.microsecond == 0
        ):
            now = now_local_naive()
            note_date = now.replace(
                year=note_date.year, month=note_date.month, day=note_date.day
            )
        payload = JournalCreatePayload(
            uid=data.uid,
            name=self._normalize_name(data.name, fallback_time=note_date),
            user_notes=user_notes,
            date=note_date,
            content_format=data.content_format or "markdown",
            content_objective=data.content_objective,
            content_ai=data.content_ai,
            mood=data.mood,
            energy=data.energy,
            day_bucket_start=data.day_bucket_start,
            tags=tags,
            related_todo_ids=data.related_todo_ids,
            related_activity_ids=data.related_activity_ids,
            origin=data.origin or "manual",
        )
        journal_id = self.repository.create(payload)
        if not journal_id:
            raise HTTPException(status_code=500, detail="创建日记失败")

        # 内容安全检测：block 抛 422，delete 自动软删+墓碑
        if payload.name or payload.user_notes:
            from lifetrace.services.content_safety import guard_create

            guard_create(
                self.db_base,
                user_id=int(getattr(self.repository, "user_id", 1)),
                resource_type="journal",
                resource_id=journal_id,
                content="\n".join(
                    part for part in (payload.name, payload.user_notes) if part
                ),
            )

        # 写入向量库（后台异步，不阻塞主请求）
        self._index_journal_async(journal_id, payload.name, payload.user_notes, data.tags)

        logger.info(f"成功创建日记: {journal_id} - {payload.name}")
        return self.get_journal(journal_id)

    def _build_update_payload(self, data: JournalUpdate) -> JournalUpdatePayload:
        update_data = data.model_dump(exclude_none=True)
        if "name" in update_data:
            update_data["name"] = self._normalize_name(update_data["name"])
        # 与 CREATE 一致：前端 date-only 更新会被解析为午夜 00:00:00，
        # 用当前时间填充（保留年月日），避免按 date DESC 排序时笔记沉底，
        # 导致用户提交后看不到刚关联的笔记。
        note_date = update_data.get("date")
        if (
            isinstance(note_date, datetime)
            and note_date.hour == 0
            and note_date.minute == 0
            and note_date.second == 0
            and note_date.microsecond == 0
        ):
            now = datetime.now()
            update_data["date"] = now.replace(
                year=note_date.year, month=note_date.month, day=note_date.day
            )
        return JournalUpdatePayload(**update_data)

    def update_journal(self, journal_id: int, data: JournalUpdate) -> JournalResponse:
        """更新日记"""
        existing = self.repository.get_by_id(journal_id)
        if not existing:
            raise HTTPException(status_code=404, detail="日记不存在")

        payload = self._build_update_payload(data)

        # date-only 更新（前端 formatDateInput 产生的午夜时间）且日期未变时，
        # 保留库里原有的 date 时间分量，避免失焦自动保存把 date 刷成当前时刻
        # 导致笔记在“全部笔记”里跳到最前。
        new_date = getattr(payload, "date", None)
        if isinstance(new_date, datetime) and new_date.tzinfo is not None:
            # aware 输入（如带 Z 的 ISO）归一为配置时区本地墙上时间（全库 date 语义）
            new_date = to_local_naive(new_date)
            object.__setattr__(payload, "date", new_date)
        if (
            isinstance(new_date, datetime)
            and new_date.hour == 0
            and new_date.minute == 0
            and new_date.second == 0
            and new_date.microsecond == 0
        ):
            old_raw = existing.get("date")
            old_date = old_raw if isinstance(old_raw, datetime) else None
            if (
                old_date is not None
                and (old_date.year, old_date.month, old_date.day)
                == (new_date.year, new_date.month, new_date.day)
            ):
                object.__setattr__(payload, "date", old_date)

        # 如果更新中包含 tags，确保 tags 以 #标签 形式写入正文
        if payload.tags is not None and payload.tags is not _UNSET:
            # 如果没传 user_notes，读取当前内容
            current_notes = payload.user_notes
            if current_notes is _UNSET:
                existing_journal = self.repository.get_by_id(journal_id)
                current_notes = (existing_journal or {}).get("user_notes", "")
            embedded = self._ensure_tags_in_content(current_notes, payload.tags)
            if embedded != current_notes:
                # JournalUpdatePayload is frozen dataclass, use object.__setattr__
                object.__setattr__(payload, "user_notes", embedded)

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

        # 反向同步：若该笔记是待办镜像，则把新内容回写到待办对应字段
        if self._sync_service is not None and not _is_peer_sync():
            current = self.repository.get_by_id(journal_id) or {}
            if current.get("origin") in TODO_ORIGINS:
                try:
                    _mark_syncing(True)
                    self._sync_service.sync_from_journal(journal_id)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(f"镜像笔记反向回写待办失败 journal={journal_id}: {exc}")
                finally:
                    _mark_syncing(False)

        return self.get_journal(journal_id)

    def delete_journal(self, journal_id: int) -> None:
        """删除日记"""
        if not self.repository.get_by_id(journal_id):
            raise HTTPException(status_code=404, detail="日记不存在")
        if not self.repository.delete(journal_id):
            raise HTTPException(status_code=500, detail="删除日记失败")

        # 从向量库删除（笔记已落库删除；云端向量删除失败会抛出可重试错误）
        self._remove_journal_index(journal_id)

        # 级联清理 NoteLink（刚删除的笔记可能被其他笔记链接）
        try:
            from lifetrace.repositories.sql_note_link_repository import (
                SqlNoteLinkRepository,
            )

            SqlNoteLinkRepository(self.db_base).delete_by_note(journal_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"清理笔记思想链接失败: {exc}")

        # 级联清理 Collection 成员关系（笔记可能属多个集合）
        try:
            from lifetrace.repositories.sql_collection_repository import (
                SqlCollectionRepository,
            )

            SqlCollectionRepository(self.db_base).delete_by_journal(journal_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"清理笔记集合成员关系失败: {exc}")

        # 级联清理 ProjectNoteRelation 成员关系（笔记可能属多个项目）
        try:
            from lifetrace.repositories.sql_project_repository import (
                SqlProjectRepository,
            )

            SqlProjectRepository(self.db_base).delete_by_journal(journal_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"清理笔记项目成员关系失败: {exc}")

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
