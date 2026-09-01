"""Admin 后台 API 路由：用户管理 + 统计看板

所有路由挂 get_current_admin 依赖，非管理员 403。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from lifetrace.core.dependencies import (
    get_admin_auth_service,
    get_current_admin,
    get_db_base,
)
from lifetrace.schemas.admin import (
    AdminLlmCostItem,
    AdminLlmCostResponse,
    AdminStatsGrowthPoint,
    AdminStatsGrowthResponse,
    AdminStatsOverview,
    AdminUserCreateRequest,
    AdminUserResetPasswordRequest,
    AdminUserResponse,
    AdminUserUpdateRequest,
)
from lifetrace.services.auth_service import (
    DuplicateUserEmailError,
    LastAdminError,
    AuthService,
)
from lifetrace.storage.models import (
    Collection,
    Journal,
    Project,
    SyncTombstone,
    Todo,
    TokenUsage,
    User,
)
from lifetrace.storage.sql_utils import col
from lifetrace.util.logging_config import get_logger
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()

# 数据管理白名单：resource -> (模型, 可搜索字段, 可编辑字段)
DATA_RESOURCES: dict[str, dict[str, Any]] = {
    "todo": {
        "model": Todo,
        "search": ["name", "description", "user_notes"],
        "editable": {"name", "description", "user_notes", "status", "priority"},
    },
    "journal": {
        "model": Journal,
        "search": ["name", "user_notes"],
        "editable": {"name", "user_notes"},
    },
    "project": {
        "model": Project,
        "search": ["name", "description"],
        "editable": {"name", "description", "color", "is_archived"},
    },
    "collection": {
        "model": Collection,
        "search": ["name", "description"],
        "editable": {"name", "description"},
    },
}

# 同步实体类型（有 SyncTombstone 的资源），删除时必须写墓碑防止多端复活
SYNC_ENTITY_TYPES = {"todo": "todo", "journal": "journal"}

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


def _user_to_response(user: User) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id or 0,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        disabled=user.deleted_at is not None,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


def _get_user_or_404(service: AuthService, user_id: int) -> User:
    """按 id 查用户（含禁用/软删除的，管理后台需要能看到）"""
    user = service.session.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


# ========== 用户管理 ==========


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    service: AuthService = Depends(get_admin_auth_service),
) -> list[AdminUserResponse]:
    return [_user_to_response(u) for u in service.list_users()]


@router.post("/users", response_model=AdminUserResponse, status_code=201)
def create_user(
    payload: AdminUserCreateRequest,
    service: AuthService = Depends(get_admin_auth_service),
) -> AdminUserResponse:
    try:
        user = service.create_user_by_admin(
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
            role=payload.role,
        )
    except DuplicateUserEmailError as exc:
        raise HTTPException(status_code=409, detail="邮箱已存在") from exc
    return _user_to_response(user)


@router.put("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    service: AuthService = Depends(get_admin_auth_service),
) -> AdminUserResponse:
    user = _get_user_or_404(service, user_id)
    if payload.role is not None:
        try:
            user = service.update_user_role(user, role=payload.role)
        except (LastAdminError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if payload.display_name is not None:
        user = service.update_display_name(user, display_name=payload.display_name)
    if payload.disabled is not None:
        if payload.disabled and user.role == "admin" and service.count_admins() <= 1:
            raise HTTPException(status_code=400, detail="不能禁用最后一个管理员")
        user = service.admin_set_disabled(user, disabled=payload.disabled)
    return _user_to_response(user)


@router.post("/users/{user_id}/reset-password", response_model=AdminUserResponse)
def reset_password(
    user_id: int,
    payload: AdminUserResetPasswordRequest,
    service: AuthService = Depends(get_admin_auth_service),
) -> AdminUserResponse:
    user = _get_user_or_404(service, user_id)
    user = service.admin_reset_password(user, new_password=payload.new_password)
    return _user_to_response(user)


# ========== 统计看板 ==========


@router.get("/stats/overview", response_model=AdminStatsOverview)
def stats_overview(
    service: AuthService = Depends(get_admin_auth_service),
) -> AdminStatsOverview:
    session = service.session

    def count(model, *, with_user: bool = True) -> int:
        q = session.query(model.id)
        if with_user:
            q = q.filter(model.deleted_at.is_(None))
        return q.count()

    return AdminStatsOverview(
        users=count(User, with_user=False),
        todos=count(Todo),
        journals=count(Journal),
        projects=count(Project),
    )


@router.get("/stats/growth", response_model=AdminStatsGrowthResponse)
def stats_growth(
    service: AuthService = Depends(get_admin_auth_service),
) -> AdminStatsGrowthResponse:
    """近 30 天用户/笔记/待办增长（按 created_at 日期分组，跨所有用户）"""
    session = service.session
    now = get_utc_now()
    from datetime import timedelta

    start = now - timedelta(days=30)

    def series(model) -> dict[str, int]:
        rows = (
            session.query(model.created_at)
            .filter(model.created_at >= start)
            .all()
        )
        buckets: dict[str, int] = {}
        for (created,) in rows:
            if created is None:
                continue
            key = created.strftime("%Y-%m-%d")
            buckets[key] = buckets.get(key, 0) + 1
        return buckets

    users_s = series(User)
    journals_s = series(Journal)
    todos_s = series(Todo)

    points: list[AdminStatsGrowthPoint] = []
    for i in range(30):
        day = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        points.append(
            AdminStatsGrowthPoint(
                date=day,
                count=users_s.get(day, 0) + journals_s.get(day, 0) + todos_s.get(day, 0),
            )
        )
    return AdminStatsGrowthResponse(series=points)


@router.get("/stats/llm-cost", response_model=AdminLlmCostResponse)
def stats_llm_cost(
    service: AuthService = Depends(get_admin_auth_service),
) -> AdminLlmCostResponse:
    session = service.session
    rows = (
        session.query(
            TokenUsage.model,
            TokenUsage.total_tokens,
            TokenUsage.total_cost,
        )
        .all()
    )
    agg: dict[str, dict[str, float]] = {}
    for model, total_tokens, total_cost in rows:
        key = model or "unknown"
        item = agg.setdefault(key, {"tokens": 0, "cost": 0.0, "calls": 0})
        item["tokens"] += total_tokens or 0
        item["cost"] += total_cost or 0.0
        item["calls"] += 1
    items = [
        AdminLlmCostItem(
            model=k,
            total_tokens=int(v["tokens"]),
            total_cost=round(v["cost"], 4),
            calls=int(v["calls"]),
        )
        for k, v in agg.items()
    ]
    items.sort(key=lambda x: x.total_cost, reverse=True)
    return AdminLlmCostResponse(items=items)


# ========== 数据管理（通用 CRUD） ==========


def _get_resource_or_404(resource: str) -> dict[str, Any]:
    spec = DATA_RESOURCES.get(resource)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"未知资源类型: {resource}")
    return spec


def _serialize_row(row: Any) -> dict[str, Any]:
    """通用序列化：datetime -> isoformat，排除大二进制字段"""
    out: dict[str, Any] = {}
    for key, value in row.__dict__.items():
        if key.startswith("_") or key == "data":
            continue
        if hasattr(value, "isoformat"):
            out[key] = value.isoformat() if value is not None else None
        else:
            out[key] = value
    return out


@router.get("/data/{resource}")
def list_data(
    resource: str,
    service: AuthService = Depends(get_admin_auth_service),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    spec = _get_resource_or_404(resource)
    model = spec["model"]
    session = service.session
    query = session.query(model)
    if hasattr(model, "deleted_at"):
        query = query.filter(col(model.deleted_at).is_(None))
    if user_id is not None:
        query = query.filter(col(model.user_id) == user_id)
    if search:
        from sqlalchemy import or_

        pattern = f"%{search}%"
        conds = [col(getattr(model, f)).ilike(pattern) for f in spec["search"]]
        query = query.filter(or_(*conds))
    total = query.count()
    rows = (
        query.order_by(col(model.created_at).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "items": [_serialize_row(r) for r in rows]}


@router.put("/data/{resource}/{item_id}")
def update_data(
    resource: str,
    item_id: int,
    payload: dict[str, Any],
    service: AuthService = Depends(get_admin_auth_service),
) -> dict[str, Any]:
    spec = _get_resource_or_404(resource)
    model = spec["model"]
    session = service.session
    row = session.query(model).filter(model.id == item_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    for key, value in payload.items():
        if key not in spec["editable"]:
            raise HTTPException(status_code=400, detail=f"字段不可编辑: {key}")
        setattr(row, key, value)
    if hasattr(row, "updated_at"):
        row.updated_at = get_utc_now()
    result = _serialize_row(row)
    session.commit()
    return result


@router.delete("/data/{resource}/{item_id}")
def delete_data(
    resource: str,
    item_id: int,
    service: AuthService = Depends(get_admin_auth_service),
    db_base: Any = Depends(get_db_base),
) -> dict[str, Any]:
    """软删除。todo/journal 额外写 SyncTombstone，防止多端同步复活已删数据"""
    spec = _get_resource_or_404(resource)
    model = spec["model"]
    session = service.session
    row = session.query(model).filter(model.id == item_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    if not hasattr(model, "deleted_at"):
        raise HTTPException(status_code=400, detail="该资源不支持软删除")
    now = get_utc_now()
    row.deleted_at = now
    if hasattr(row, "updated_at"):
        row.updated_at = now
    session.commit()

    entity_type = SYNC_ENTITY_TYPES.get(resource)
    uid = getattr(row, "uid", None)
    if entity_type and uid and getattr(row, "user_id", None):
        with db_base.get_session() as s:
            tomb = (
                s.query(SyncTombstone)
                .filter_by(user_id=row.user_id, entity_type=entity_type, uid=uid)
                .first()
            )
            if tomb:
                tomb.deleted_at = now
            else:
                s.add(
                    SyncTombstone(
                        user_id=row.user_id,
                        entity_type=entity_type,
                        uid=uid,
                        deleted_at=now,
                    )
                )
    return {"success": True}
