"""零秒思考相关路由"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from lifetrace.core.dependencies import get_zero_think_service
from lifetrace.schemas.zero_think import (
    ZeroThinkCardCreate,
    ZeroThinkCardResponse,
    ZeroThinkStatsResponse,
)
from lifetrace.services.zero_think_service import ZeroThinkService
from lifetrace.util.logging_config import get_logger

logger = get_logger()

router = APIRouter(tags=["zero-think"])


@router.post("/api/zero-think/card", response_model=ZeroThinkCardResponse, status_code=201)
async def create_card(
    data: ZeroThinkCardCreate,
    service: ZeroThinkService = Depends(get_zero_think_service),
):
    """创建零秒思考卡片"""
    try:
        return service.create_card(data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建零秒思考卡片失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建零秒思考卡片失败: {e!s}") from e


@router.get("/api/zero-think/cards", response_model=list[ZeroThinkCardResponse])
async def get_cards(
    date: str | None = Query(None, description="日期筛选 YYYY-MM-DD"),
    start_date: str | None = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
    service: ZeroThinkService = Depends(get_zero_think_service),
):
    """获取零秒思考卡片列表"""
    try:
        if date:
            return service.get_cards_by_date(date)
        if start_date and end_date:
            return service.get_cards_by_date_range(start_date, end_date)
        # 默认返回今天的卡片
        from datetime import datetime

        today = datetime.now().strftime("%Y-%m-%d")
        return service.get_cards_by_date(today)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取零秒思考卡片失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取零秒思考卡片失败: {e!s}") from e


@router.get("/api/zero-think/stats", response_model=ZeroThinkStatsResponse)
async def get_stats(
    service: ZeroThinkService = Depends(get_zero_think_service),
):
    """获取零秒思考统计信息"""
    try:
        return service.get_stats()
    except Exception as e:
        logger.error(f"获取零秒思考统计失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取零秒思考统计失败: {e!s}") from e


@router.post("/api/zero-think/{card_id}/lock", response_model=ZeroThinkCardResponse)
async def lock_card(
    card_id: str = Path(..., description="卡片ID"),
    service: ZeroThinkService = Depends(get_zero_think_service),
):
    """锁定零秒思考卡片"""
    try:
        return service.lock_card(card_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"锁定零秒思考卡片失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"锁定零秒思考卡片失败: {e!s}") from e


@router.delete("/api/zero-think/{card_id}", status_code=204)
async def delete_card(
    card_id: str = Path(..., description="卡片ID"),
    service: ZeroThinkService = Depends(get_zero_think_service),
):
    """删除零秒思考卡片"""
    try:
        service.delete_card(card_id)
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除零秒思考卡片失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"删除零秒思考卡片失败: {e!s}") from e
