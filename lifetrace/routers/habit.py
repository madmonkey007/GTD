"""习惯相关路由"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from lifetrace.core.dependencies import get_habit_service
from lifetrace.schemas.habit import (
    HabitCreate,
    HabitListResponse,
    HabitRecordCreate,
    HabitResponse,
    HabitUpdate,
)
from lifetrace.services.habit_service import HabitService

router = APIRouter(tags=["habits"])


@router.get("/api/habits", response_model=HabitListResponse)
async def list_habits(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None, min_length=1, max_length=200),
    service: HabitService = Depends(get_habit_service),
):
    """获取习惯列表"""
    return service.list_habits(limit=limit, offset=offset, search=search)


@router.get("/api/habits/{habit_id}", response_model=HabitResponse)
async def get_habit(
    habit_id: int = Path(...),
    service: HabitService = Depends(get_habit_service),
):
    return service.get_habit(habit_id)


@router.post("/api/habits", response_model=HabitResponse, status_code=201)
async def create_habit(
    habit: HabitCreate,
    service: HabitService = Depends(get_habit_service),
):
    try:
        return service.create_habit(habit)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建习惯失败: {e!s}") from e


@router.put("/api/habits/{habit_id}", response_model=HabitResponse)
async def update_habit(
    habit_id: int = Path(...),
    habit: HabitUpdate | None = None,
    service: HabitService = Depends(get_habit_service),
):
    if habit is None:
        raise HTTPException(status_code=400, detail="缺少习惯更新内容")
    return service.update_habit(habit_id, habit)


@router.delete("/api/habits/{habit_id}", status_code=204)
async def delete_habit(
    habit_id: int = Path(...),
    service: HabitService = Depends(get_habit_service),
):
    service.delete_habit(habit_id)


@router.get("/api/habits/{habit_id}/records")
async def list_records(
    habit_id: int = Path(...),
    limit: int = Query(100, ge=1, le=1000),
    service: HabitService = Depends(get_habit_service),
):
    return {"records": service.list_records(habit_id, limit=limit)}


@router.get("/api/habits/records/all")
async def list_all_records(
    limit: int = Query(5000, ge=1, le=20000),
    service: HabitService = Depends(get_habit_service),
):
    """列出所有习惯的打卡记录（供前端聚合统计）。"""
    return {"records": service.list_all_records(limit=limit)}


@router.post("/api/habits/{habit_id}/records")
async def toggle_record(
    habit_id: int = Path(...),
    body: HabitRecordCreate | None = None,
    service: HabitService = Depends(get_habit_service),
):
    """打卡（幂等切换：当天已有则取消，无则新增）。"""
    if body is None:
        raise HTTPException(status_code=400, detail="缺少打卡日期")
    return service.toggle_record(habit_id, body.date)


@router.delete("/api/habits/{habit_id}/records/{record_date}", status_code=204)
async def remove_record(
    habit_id: int = Path(...),
    record_date: str = Path(...),
    service: HabitService = Depends(get_habit_service),
):
    """取消某日打卡（record_date 格式 YYYY-MM-DD）。"""
    try:
        dt = datetime.strptime(record_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="日期格式需为 YYYY-MM-DD")
    from lifetrace.services.habit_service import _normalize_record_date

    service.repository.remove_record(habit_id, _normalize_record_date(dt))
