"""零秒思考卡片管理器 - 负责零秒思考卡片的数据库操作"""

import json
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy.exc import SQLAlchemyError

from lifetrace.storage.database_base import DatabaseBase
from lifetrace.storage.models import ZeroThinkCard
from lifetrace.storage.sql_utils import col
from lifetrace.util.logging_config import get_logger
from lifetrace.util.time_utils import get_utc_now

logger = get_logger()

DEFAULT_USER_ID = "default"


class ZeroThinkManager:
    """零秒思考卡片管理类"""

    def __init__(self, db_base: DatabaseBase):
        self.db_base = db_base

    def _serialize_card(self, card: ZeroThinkCard) -> dict[str, Any]:
        """序列化卡片为字典"""
        try:
            answers = json.loads(card.answers) if card.answers else []
        except (json.JSONDecodeError, TypeError):
            answers = []

        return {
            "id": card.id,
            "user_id": card.user_id,
            "date": card.date,
            "question": card.question,
            "answers": answers,
            "day_index": card.day_index,
            "mode": card.mode or "scattered",
            "duration_ms": card.duration_ms or 0,
            "is_locked": card.is_locked or False,
            "category": card.category or "",
            "created_at": card.created_at.isoformat() if card.created_at else "",
        }

    def create_card(
        self,
        user_id: str,
        date_str: str,
        question: str,
        answers: list[str],
        day_index: int,
        mode: str = "scattered",
        duration_ms: int = 0,
    ) -> dict[str, Any] | None:
        """创建零秒思考卡片"""
        try:
            with self.db_base.get_session() as session:
                card = ZeroThinkCard(
                    id=f"zt_{uuid4().hex[:12]}",
                    user_id=user_id,
                    date=date_str,
                    question=question,
                    answers=json.dumps(answers, ensure_ascii=False),
                    day_index=day_index,
                    mode=mode,
                    duration_ms=duration_ms,
                )
                session.add(card)
                session.flush()
                logger.info(f"创建零秒思考卡片: {card.id} - {question[:30]}")
                return self._serialize_card(card)
        except SQLAlchemyError as e:
            logger.error(f"创建零秒思考卡片失败: {e}")
            return None

    def get_cards_by_date(self, user_id: str, date_str: str) -> list[dict[str, Any]]:
        """获取指定日期的所有卡片"""
        try:
            with self.db_base.get_session() as session:
                cards = (
                    session.query(ZeroThinkCard)
                    .filter(col(ZeroThinkCard.user_id) == user_id)
                    .filter(col(ZeroThinkCard.date) == date_str)
                    .order_by(col(ZeroThinkCard.day_index).asc())
                    .all()
                )
                return [self._serialize_card(card) for card in cards]
        except SQLAlchemyError as e:
            logger.error(f"获取零秒思考卡片失败: {e}")
            return []

    def get_cards_by_date_range(
        self, user_id: str, start_date: str, end_date: str
    ) -> list[dict[str, Any]]:
        """获取日期范围内的所有卡片"""
        try:
            with self.db_base.get_session() as session:
                cards = (
                    session.query(ZeroThinkCard)
                    .filter(col(ZeroThinkCard.user_id) == user_id)
                    .filter(col(ZeroThinkCard.date) >= start_date)
                    .filter(col(ZeroThinkCard.date) <= end_date)
                    .order_by(col(ZeroThinkCard.date).desc(), col(ZeroThinkCard.day_index).asc())
                    .all()
                )
                return [self._serialize_card(card) for card in cards]
        except SQLAlchemyError as e:
            logger.error(f"获取零秒思考卡片范围查询失败: {e}")
            return []

    def get_stats(self, user_id: str) -> dict[str, Any]:
        """计算统计信息：总天数、连续天数、最佳连续天数、今日数量、今日是否完成"""
        try:
            with self.db_base.get_session() as session:
                today_str = get_utc_now().strftime("%Y-%m-%d")

                # 查询所有有卡片的日期（去重）
                from sqlalchemy import distinct

                all_dates = (
                    session.query(distinct(col(ZeroThinkCard.date)))
                    .filter(col(ZeroThinkCard.user_id) == user_id)
                    .order_by(col(ZeroThinkCard.date).desc())
                    .all()
                )
                date_list = sorted({row[0] for row in all_dates}, reverse=True)

                total_days = len(date_list)

                # 今日卡片数量
                today_count = (
                    session.query(ZeroThinkCard)
                    .filter(col(ZeroThinkCard.user_id) == user_id)
                    .filter(col(ZeroThinkCard.date) == today_str)
                    .count()
                )
                today_completed = today_count >= 10

                # 计算连续天数
                current_streak = 0
                best_streak = 0
                streak = 0

                if date_list:
                    # 从最近一天开始往回算连续天数
                    check_date = datetime.strptime(date_list[0], "%Y-%m-%d").date()
                    today_date = datetime.strptime(today_str, "%Y-%m-%d").date()

                    # 如果最近一天不是今天或昨天，连续天数为0
                    if (today_date - check_date).days <= 1:
                        for i, date_str in enumerate(date_list):
                            d = datetime.strptime(date_str, "%Y-%m-%d").date()
                            if i == 0:
                                streak = 1
                            else:
                                prev = datetime.strptime(date_list[i - 1], "%Y-%m-%d").date()
                                if (prev - d).days == 1:
                                    streak += 1
                                else:
                                    break
                        current_streak = streak

                    # 计算最佳连续天数（遍历所有日期）
                    streak = 0
                    for i, date_str in enumerate(date_list):
                        d = datetime.strptime(date_str, "%Y-%m-%d").date()
                        if i == 0:
                            streak = 1
                        else:
                            prev = datetime.strptime(date_list[i - 1], "%Y-%m-%d").date()
                            if (prev - d).days == 1:
                                streak += 1
                            else:
                                best_streak = max(best_streak, streak)
                                streak = 1
                    best_streak = max(best_streak, streak)

                return {
                    "total_days": total_days,
                    "current_streak": current_streak,
                    "best_streak": best_streak,
                    "today_count": today_count,
                    "today_completed": today_completed,
                }
        except SQLAlchemyError as e:
            logger.error(f"获取零秒思考统计失败: {e}")
            return {
                "total_days": 0,
                "current_streak": 0,
                "best_streak": 0,
                "today_count": 0,
                "today_completed": False,
            }

    def lock_card(self, card_id: str) -> dict[str, Any] | None:
        """锁定卡片"""
        try:
            with self.db_base.get_session() as session:
                card = (
                    session.query(ZeroThinkCard)
                    .filter(col(ZeroThinkCard.id) == card_id)
                    .first()
                )
                if not card:
                    logger.warning(f"零秒思考卡片不存在: {card_id}")
                    return None
                card.is_locked = True
                card.updated_at = get_utc_now()
                session.flush()
                logger.info(f"锁定零秒思考卡片: {card_id}")
                return self._serialize_card(card)
        except SQLAlchemyError as e:
            logger.error(f"锁定零秒思考卡片失败: {e}")
            return None

    def delete_card(self, card_id: str) -> bool:
        """删除卡片（物理删除）"""
        try:
            with self.db_base.get_session() as session:
                card = (
                    session.query(ZeroThinkCard)
                    .filter(col(ZeroThinkCard.id) == card_id)
                    .first()
                )
                if not card:
                    logger.warning(f"零秒思考卡片不存在: {card_id}")
                    return False
                session.delete(card)
                session.flush()
                logger.info(f"删除零秒思考卡片: {card_id}")
                return True
        except SQLAlchemyError as e:
            logger.error(f"删除零秒思考卡片失败: {e}")
            return False
