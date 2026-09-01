"""Admin 内容安全 API：关键字规则、违规审核、全库扫描

所有路由挂 get_current_admin 依赖，非管理员 403。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from lifetrace.core.dependencies import get_current_admin, get_db_session
from lifetrace.routers.admin import DATA_RESOURCES, SYNC_ENTITY_TYPES
from lifetrace.services import content_safety
from lifetrace.storage.models import ContentViolation, KeywordRule
from lifetrace.util.logging_config import get_logger
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()

router = APIRouter(
    prefix="/api/admin/safety",
    tags=["admin-safety"],
    dependencies=[Depends(get_current_admin)],
)


# ========== Schemas ==========


class KeywordRuleIn(BaseModel):
    pattern: str = Field(min_length=1, max_length=500)
    is_regex: bool = False
    category: str = Field(default="custom", max_length=32)
    action: str = Field(default="flag")
    enabled: bool = True
    remark: str = Field(default="", max_length=200)


class KeywordRuleOut(BaseModel):
    id: int
    pattern: str
    is_regex: bool
    category: str
    action: str
    enabled: bool
    remark: str
    created_at: str | None
    updated_at: str | None


class BatchImportIn(BaseModel):
    patterns: list[str] = Field(min_length=1)
    category: str = "custom"
    action: str = "flag"


class ViolationOut(BaseModel):
    id: int
    user_id: int
    resource_type: str
    resource_id: int
    rule_id: int
    rule_pattern: str
    matched_excerpt: str
    action_taken: str
    status: str
    created_at: str | None


class ResolveIn(BaseModel):
    decision: str  # delete / ignore


def _rule_out(rule: KeywordRule) -> KeywordRuleOut:
    return KeywordRuleOut(
        id=rule.id or 0,
        pattern=rule.pattern,
        is_regex=rule.is_regex,
        category=rule.category,
        action=rule.action,
        enabled=rule.enabled,
        remark=rule.remark,
        created_at=rule.created_at.isoformat() if rule.created_at else None,
        updated_at=rule.updated_at.isoformat() if rule.updated_at else None,
    )


def _violation_out(v: ContentViolation) -> ViolationOut:
    return ViolationOut(
        id=v.id or 0,
        user_id=v.user_id,
        resource_type=v.resource_type,
        resource_id=v.resource_id,
        rule_id=v.rule_id,
        rule_pattern=v.rule_pattern,
        matched_excerpt=v.matched_excerpt,
        action_taken=v.action_taken,
        status=v.status,
        created_at=v.created_at.isoformat() if v.created_at else None,
    )


def _validate_action(action: str) -> None:
    if action not in content_safety.VALID_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"无效动作：{action}，可选 {sorted(content_safety.VALID_ACTIONS)}",
        )


# ========== 关键字规则 ==========


@router.get("/keywords", response_model=list[KeywordRuleOut])
def list_keywords(session: Session = Depends(get_db_session)) -> list[KeywordRuleOut]:
    rules = session.query(KeywordRule).order_by(KeywordRule.id.desc()).all()
    return [_rule_out(r) for r in rules]


@router.post("/keywords", response_model=KeywordRuleOut, status_code=201)
def create_keyword(
    payload: KeywordRuleIn, session: Session = Depends(get_db_session)
) -> KeywordRuleOut:
    _validate_action(payload.action)
    rule = KeywordRule(**payload.model_dump())
    session.add(rule)
    session.commit()
    session.refresh(rule)
    content_safety.invalidate_rule_cache()
    logger.info("[Safety] 新增关键字规则 #%s: %s", rule.id, rule.pattern)
    return _rule_out(rule)


@router.post("/keywords/batch", response_model=dict)
def batch_import(
    payload: BatchImportIn, session: Session = Depends(get_db_session)
) -> dict:
    _validate_action(payload.action)
    created = 0
    seen: set[str] = set()
    for raw in payload.patterns:
        pattern = raw.strip()
        if not pattern or pattern in seen:
            continue
        seen.add(pattern)
        session.add(
            KeywordRule(
                pattern=pattern[:500],
                category=payload.category,
                action=payload.action,
            )
        )
        created += 1
    session.commit()
    content_safety.invalidate_rule_cache()
    logger.info("[Safety] 批量导入 %s 条关键字规则", created)
    return {"created": created}


@router.put("/keywords/{rule_id}", response_model=KeywordRuleOut)
def update_keyword(
    rule_id: int, payload: KeywordRuleIn, session: Session = Depends(get_db_session)
) -> KeywordRuleOut:
    rule = session.query(KeywordRule).filter(KeywordRule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="规则不存在")
    _validate_action(payload.action)
    for key, value in payload.model_dump().items():
        setattr(rule, key, value)
    rule.updated_at = get_utc_now()
    result = _rule_out(rule)
    session.commit()
    content_safety.invalidate_rule_cache()
    return result


@router.delete("/keywords/{rule_id}", response_model=dict)
def delete_keyword(rule_id: int, session: Session = Depends(get_db_session)) -> dict:
    rule = session.query(KeywordRule).filter(KeywordRule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="规则不存在")
    session.delete(rule)
    session.commit()
    content_safety.invalidate_rule_cache()
    logger.info("[Safety] 删除关键字规则 #%s", rule_id)
    return {"success": True}


# ========== 违规记录 ==========


@router.get("/violations")
def list_violations(
    session: Session = Depends(get_db_session),
    status: str | None = Query(None),
    resource_type: str | None = Query(None),
    user_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    q = session.query(ContentViolation)
    if status:
        q = q.filter(ContentViolation.status == status)
    if resource_type:
        q = q.filter(ContentViolation.resource_type == resource_type)
    if user_id is not None:
        q = q.filter(ContentViolation.user_id == user_id)
    total = q.count()
    rows = (
        q.order_by(ContentViolation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "items": [_violation_out(v) for v in rows]}


@router.post("/violations/{violation_id}/resolve", response_model=dict)
def resolve_violation(
    violation_id: int,
    payload: ResolveIn,
    session: Session = Depends(get_db_session),
) -> dict:
    if payload.decision not in ("delete", "ignore"):
        raise HTTPException(status_code=400, detail="decision 必须是 delete 或 ignore")
    violation = (
        session.query(ContentViolation)
        .filter(ContentViolation.id == violation_id)
        .first()
    )
    if violation is None:
        raise HTTPException(status_code=404, detail="违规记录不存在")

    if payload.decision == "delete":
        _delete_resource(session, violation)

    violation.status = "resolved" if payload.decision == "delete" else "ignored"
    violation.resolved_at = get_utc_now()
    session.commit()
    logger.info(
        "[Safety] 违规记录 #%s 处置: %s", violation_id, payload.decision
    )
    return {"success": True}


def _delete_resource(session, violation: ContentViolation) -> None:
    """软删除违规内容并写同步墓碑（防止多端复活）。"""
    resource_cfg = DATA_RESOURCES.get(violation.resource_type)
    if resource_cfg is None:
        raise HTTPException(status_code=400, detail="不支持的内容类型")
    model = resource_cfg["model"]
    row = session.query(model).filter(model.id == violation.resource_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="内容已不存在")
    now = get_utc_now()
    row.deleted_at = now  # type: ignore[attr-defined]
    row.updated_at = now  # type: ignore[attr-defined]
    if violation.resource_type in SYNC_ENTITY_TYPES:
        from lifetrace.storage.models import SyncTombstone

        uid = getattr(row, "uid", None)
        user_id = getattr(row, "user_id", None)
        if uid and user_id:
            tomb = (
                session.query(SyncTombstone)
                .filter(
                    SyncTombstone.user_id == user_id,
                    SyncTombstone.entity_type == violation.resource_type,
                    SyncTombstone.uid == uid,
                )
                .first()
            )
            if tomb is None:
                session.add(
                    SyncTombstone(
                        user_id=user_id,
                        entity_type=violation.resource_type,
                        uid=uid,
                        deleted_at=now,
                    )
                )
            else:
                tomb.deleted_at = now
    logger.warning(
        "[Safety] 违规内容已删除: %s#%s (user=%s)",
        violation.resource_type,
        violation.resource_id,
        violation.user_id,
    )


# ========== 全库扫描 ==========


@router.post("/scan", response_model=dict)
def scan_all(session: Session = Depends(get_db_session)) -> dict:
    """扫描全部业务数据，命中按 flag 记录（不自动删除，由管理员处置）。"""
    total_scanned = 0
    total_hits = 0
    for resource_type, cfg in DATA_RESOURCES.items():
        model = cfg["model"]
        fields = [f for f in ("name", "description", "user_notes") if hasattr(model, f)]
        rows = (
            session.query(model)
            .filter(model.deleted_at.is_(None))  # type: ignore[attr-defined]
            .all()
        )
        for row in rows:
            total_scanned += 1
            content = "\n".join(
                str(getattr(row, f) or "") for f in fields
            )
            if not content.strip():
                continue
            hits = content_safety.match_content(session, content)
            if hits:
                total_hits += len(hits)
                content_safety.record_hits(
                    session,
                    user_id=getattr(row, "user_id", 0) or 0,
                    resource_type=resource_type,
                    resource_id=row.id,  # type: ignore[attr-defined]
                    hits=hits,
                    action_taken="flag",
                )
    session.commit()
    logger.info(
        "[Safety] 全库扫描完成: %s 条内容, %s 处命中", total_scanned, total_hits
    )
    return {"scanned": total_scanned, "hits": total_hits}


# ========== 统计 ==========


@router.get("/stats", response_model=dict)
def safety_stats(session: Session = Depends(get_db_session)) -> dict:
    by_action_rows = (
        session.query(ContentViolation.action_taken, ContentViolation.status).all()
    )
    by_action: dict[str, int] = {}
    for action, _status in by_action_rows:
        by_action[action] = by_action.get(action, 0) + 1
    return {
        "total_rules": session.query(KeywordRule).count(),
        "enabled_rules": (
            session.query(KeywordRule).filter(KeywordRule.enabled.is_(True)).count()
        ),
        "pending_violations": (
            session.query(ContentViolation)
            .filter(ContentViolation.status == "pending")
            .count()
        ),
        "total_violations": session.query(ContentViolation).count(),
        "by_action": by_action,
    }

