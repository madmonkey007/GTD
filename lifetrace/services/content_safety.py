"""内容安全检测引擎：关键字匹配 + 违规记录落库 + 按 action 处置

规则缓存在进程内，规则变更时调用 invalidate_rule_cache()。
"""

from __future__ import annotations

import re

from fastapi import HTTPException

from lifetrace.storage.models import ContentViolation, Journal, KeywordRule, Todo
from lifetrace.util.logging_config import get_logger
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()

# 动作常量
ACTION_FLAG = "flag"  # 仅记录
ACTION_BLOCK = "block"  # 阻止提交（返回 422）
ACTION_DELETE = "delete"  # 自动软删除

VALID_ACTIONS = {ACTION_FLAG, ACTION_BLOCK, ACTION_DELETE}

# 命中摘要：命中词前后各保留 EXCERPT_CONTEXT 字符，命中词本身脱敏为 ***
EXCERPT_CONTEXT = 20

_rule_cache: list[tuple[int, str, bool, str, re.Pattern[str] | None]] | None = None


def invalidate_rule_cache() -> None:
    """规则增删改后调用，强制下次检测重新加载。"""
    global _rule_cache
    _rule_cache = None


def load_enabled_rules(
    session,
) -> list[tuple[int, str, bool, str, re.Pattern[str] | None]]:
    """加载启用的规则并预编译正则（带进程内缓存）。

    缓存存纯数据 (id, pattern, is_regex, action, compiled)，避免持有
    ORM 实例在 session 关闭后触发 DetachedInstanceError。
    """
    global _rule_cache
    if _rule_cache is None:
        rules = session.query(KeywordRule).filter(KeywordRule.enabled.is_(True)).all()
        compiled: list[tuple[int, str, bool, str, re.Pattern[str] | None]] = []
        for rule in rules:
            pattern: re.Pattern[str] | None = None
            if rule.is_regex:
                try:
                    pattern = re.compile(rule.pattern, re.IGNORECASE)
                except re.error as exc:
                    logger.warning("[Safety] 无效正则规则 %s: %s", rule.id, exc)
                    continue
            compiled.append((rule.id, rule.pattern, rule.is_regex, rule.action, pattern))
        _rule_cache = compiled
    return _rule_cache


def _make_excerpt(content: str, start: int, end: int) -> str:
    """生成命中片段脱敏摘要：命中部分替换为 ***，前后保留少量上下文。"""
    prefix_start = max(0, start - EXCERPT_CONTEXT)
    suffix_end = min(len(content), end + EXCERPT_CONTEXT)
    prefix = ("…" if prefix_start > 0 else "") + content[prefix_start:start]
    suffix = content[end:suffix_end] + ("…" if suffix_end < len(content) else "")
    return f"{prefix}***{suffix}"


def match_content(
    session, content: str
) -> list[tuple[tuple[int, str, bool, str, re.Pattern[str] | None], str]]:
    """返回命中的 (规则数据, 脱敏摘要) 列表。content 为空时返回空。"""
    if not content:
        return []
    hits: list[tuple[tuple[int, str, bool, str, re.Pattern[str] | None], str]] = []
    seen_rules: set[int] = set()
    for rule_id, pattern_text, is_regex, _action, pattern in load_enabled_rules(session):
        if rule_id in seen_rules:
            continue
        if is_regex and pattern is not None:
            m = pattern.search(content)
            if m:
                seen_rules.add(rule_id)
                hits.append(
                    (
                        (rule_id, pattern_text, is_regex, _action, pattern),
                        _make_excerpt(content, m.start(), m.end()),
                    )
                )
        elif not is_regex and pattern_text.lower() in content.lower():
            start = content.lower().index(pattern_text.lower())
            seen_rules.add(rule_id)
            hits.append(
                (
                    (rule_id, pattern_text, is_regex, _action, pattern),
                    _make_excerpt(content, start, start + len(pattern_text)),
                )
            )
    return hits


def record_hits(
    session,
    *,
    user_id: int,
    resource_type: str,
    resource_id: int,
    hits: list[tuple[tuple[int, str, bool, str, re.Pattern[str] | None], str]],
    action_taken: str,
) -> None:
    """把命中结果落库为违规记录（同规则同资源去重：已有 pending 记录则跳过）。"""
    for (rule_id, pattern_text, _is_regex, _action, _pattern), excerpt in hits:
        exists = (
            session.query(ContentViolation)
            .filter(
                ContentViolation.rule_id == rule_id,
                ContentViolation.resource_type == resource_type,
                ContentViolation.resource_id == resource_id,
                ContentViolation.status == "pending",
            )
            .first()
        )
        if exists:
            continue
        session.add(
            ContentViolation(
                user_id=user_id,
                resource_type=resource_type,
                resource_id=resource_id,
                rule_id=rule_id,
                rule_pattern=pattern_text,
                matched_excerpt=excerpt,
                action_taken=action_taken,
                status="pending",
                created_at=get_utc_now(),
            )
        )


def check_content(
    session,
    *,
    user_id: int,
    resource_type: str,
    resource_id: int,
    content: str,
) -> str | None:
    """检测内容并按最高严重级动作处置记录。

    返回命中的最严重动作（block > delete > flag），未命中返回 None。
    注意：delete 动作的软删除由调用方执行（各资源的删除逻辑不同），
    本函数只负责记录违规与返回判定结果。
    """
    hits = match_content(session, content)
    if not hits:
        return None

    severity = {ACTION_FLAG: 0, ACTION_DELETE: 1, ACTION_BLOCK: 2}
    worst = max(hits, key=lambda h: severity.get(h[0][3], 0))[0][3]
    record_hits(
        session,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        hits=hits,
        action_taken=worst,
    )
    return worst


def guard_create(db_base, *, user_id: int, resource_type: str, resource_id: int, content: str) -> str | None:
    """service 层便捷入口：检测新创建的内容并返回最严重动作。

    - block：抛 HTTPException(422)，内容不保留（调用方在创建前调用即可拦截）
    - delete：内容已落库，此处执行软删除+写墓碑
    - flag：仅记录
    返回最严重动作，无规则或异常时返回 None（不阻断业务）。
    """
    try:
        with db_base.get_session() as session:
            action = check_content(
                session,
                user_id=user_id,
                resource_type=resource_type,
                resource_id=resource_id,
                content=content,
            )
            if action is None:
                return None
            if action == ACTION_BLOCK:
                raise HTTPException(
                    status_code=422,
                    detail="内容包含违规关键字，无法提交",
                )
            if action == ACTION_DELETE:
                _soft_delete_row(session, resource_type, resource_id, user_id)
                session.commit()
            return action
    except HTTPException:
        raise
    except Exception:
        logger.exception("[Safety] 内容安全检测异常，放行内容 %s#%s", resource_type, resource_id)
        return None


def _soft_delete_row(session, resource_type: str, resource_id: int, user_id: int) -> None:
    """按资源类型软删除并写同步墓碑。"""
    from lifetrace.storage.models import SyncTombstone

    model_map = {"todo": Todo, "journal": Journal}
    model = model_map.get(resource_type)
    if model is None:
        return
    row = session.query(model).filter(model.id == resource_id).first()
    if row is None:
        return
    now = get_utc_now()
    row.deleted_at = now  # type: ignore[attr-defined]
    row.updated_at = now  # type: ignore[attr-defined]
    uid = getattr(row, "uid", None)
    if uid:
        tomb = (
            session.query(SyncTombstone)
            .filter(
                SyncTombstone.user_id == user_id,
                SyncTombstone.entity_type == resource_type,
                SyncTombstone.uid == uid,
            )
            .first()
        )
        if tomb is None:
            session.add(
                SyncTombstone(
                    user_id=user_id,
                    entity_type=resource_type,
                    uid=uid,
                    deleted_at=now,
                )
            )
        else:
            tomb.deleted_at = now
    logger.warning(
        "[Safety] 违规内容已自动删除: %s#%s (user=%s)", resource_type, resource_id, user_id
    )
