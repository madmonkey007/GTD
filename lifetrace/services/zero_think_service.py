"""零秒思考业务逻辑层

处理零秒思考相关的业务逻辑，与数据访问层解耦。
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from fastapi import HTTPException

from lifetrace.schemas.zero_think import (
    ZeroThinkCardCreate,
    ZeroThinkCardResponse,
    ZeroThinkDailySummary,
    ZeroThinkStatsResponse,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()

if TYPE_CHECKING:
    from lifetrace.storage.zero_think_manager import ZeroThinkManager

DEFAULT_USER_ID = "default"


class ZeroThinkService:
    """零秒思考业务逻辑层"""

    def __init__(self, manager: ZeroThinkManager):
        self.manager = manager

    def create_card(self, data: ZeroThinkCardCreate) -> ZeroThinkCardResponse:
        """创建零秒思考卡片"""
        today_str = datetime.now().strftime("%Y-%m-%d")
        result = self.manager.create_card(
            user_id=DEFAULT_USER_ID,
            date_str=today_str,
            question=data.question,
            answers=data.answers,
            day_index=data.day_index,
            mode=data.mode,
            duration_ms=data.duration_ms,
        )
        if not result:
            raise HTTPException(status_code=500, detail="创建零秒思考卡片失败")
        logger.info(f"成功创建零秒思考卡片: {result['id']}")
        return ZeroThinkCardResponse(**result)

    def get_cards_by_date(self, date_str: str) -> list[ZeroThinkCardResponse]:
        """获取指定日期的卡片"""
        cards = self.manager.get_cards_by_date(DEFAULT_USER_ID, date_str)
        return [ZeroThinkCardResponse(**c) for c in cards]

    def get_cards_by_date_range(
        self, start_date: str, end_date: str
    ) -> list[ZeroThinkCardResponse]:
        """获取日期范围内的卡片"""
        cards = self.manager.get_cards_by_date_range(DEFAULT_USER_ID, start_date, end_date)
        return [ZeroThinkCardResponse(**c) for c in cards]

    def get_stats(self) -> ZeroThinkStatsResponse:
        """获取统计信息"""
        stats = self.manager.get_stats(DEFAULT_USER_ID)
        return ZeroThinkStatsResponse(**stats)

    def lock_card(self, card_id: str) -> ZeroThinkCardResponse:
        """锁定卡片"""
        result = self.manager.lock_card(card_id)
        if not result:
            raise HTTPException(status_code=404, detail="卡片不存在")
        return ZeroThinkCardResponse(**result)

    def delete_card(self, card_id: str) -> None:
        """删除卡片"""
        if not self.manager.delete_card(card_id):
            raise HTTPException(status_code=404, detail="卡片不存在")
