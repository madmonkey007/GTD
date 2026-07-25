"""基于 SQLAlchemy 的 Habit 仓库实现

直接操作 db_base 会话，返回 dict 以避免 detached instance 问题（与 journal_manager 风格一致）。
"""

from datetime import datetime
from typing import Any

from lifetrace.storage.database_base import DatabaseBase
from lifetrace.storage.models import Habit, HabitRecord
from lifetrace.util.logging_config import get_logger

logger = get_logger()


def _habit_to_dict(habit: Habit) -> dict[str, Any]:
    return {
        "id": habit.id,
        "uid": habit.uid,
        "name": habit.name,
        "icon": habit.icon,
        "frequency": habit.frequency,
        "goal": habit.goal,
        "start_date": habit.start_date,
        "persistence_days": habit.persistence_days,
        "group": habit.group,
        "created_at": habit.created_at,
        "updated_at": habit.updated_at,
    }


def _record_to_dict(record: HabitRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "habit_id": record.habit_id,
        "record_date": record.record_date,
        "created_at": record.created_at,
    }


class SqlHabitRepository:
    """基于 SQLAlchemy 的 Habit 仓库"""

    def __init__(self, db_base: DatabaseBase):
        self.db_base = db_base

    def get_by_id(self, habit_id: int) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            habit = session.query(Habit).filter_by(id=habit_id, deleted_at=None).first()
            return _habit_to_dict(habit) if habit else None

    def list_habits(
        self,
        limit: int = 100,
        offset: int = 0,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        with self.db_base.get_session() as session:
            query = session.query(Habit).filter(Habit.deleted_at.is_(None))
            if search:
                like = f"%{search}%"
                query = query.filter(Habit.name.like(like))
            query = query.order_by(Habit.created_at.desc()).limit(limit).offset(offset)
            return [_habit_to_dict(h) for h in query.all()]

    def count(self, search: str | None = None) -> int:
        with self.db_base.get_session() as session:
            query = session.query(Habit).filter(Habit.deleted_at.is_(None))
            if search:
                query = query.filter(Habit.name.like(f"%{search}%"))
            return query.count()

    def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        with self.db_base.get_session() as session:
            habit = Habit(**fields)
            session.add(habit)
            session.flush()
            result = _habit_to_dict(habit)
            session.commit()
            return result

    def update(self, habit_id: int, fields: dict[str, Any]) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            habit = session.query(Habit).filter_by(id=habit_id, deleted_at=None).first()
            if not habit:
                return None
            for key, value in fields.items():
                setattr(habit, key, value)
            session.flush()
            result = _habit_to_dict(habit)
            session.commit()
            return result

    def delete(self, habit_id: int) -> bool:
        """软删除习惯，并清理其打卡记录。"""
        with self.db_base.get_session() as session:
            habit = session.query(Habit).filter_by(id=habit_id, deleted_at=None).first()
            if not habit:
                return False
            habit.deleted_at = datetime.utcnow()
            session.query(HabitRecord).filter_by(habit_id=habit_id).delete(
                synchronize_session=False
            )
            session.commit()
            return True

    # ---- 打卡记录 ----

    def list_records(self, habit_id: int, limit: int = 100) -> list[dict[str, Any]]:
        with self.db_base.get_session() as session:
            query = (
                session.query(HabitRecord)
                .filter_by(habit_id=habit_id, deleted_at=None)
                .order_by(HabitRecord.record_date.desc())
                .limit(limit)
            )
            return [_record_to_dict(r) for r in query.all()]

    def list_all_records(self, limit: int = 5000) -> list[dict[str, Any]]:
        """列出所有习惯的打卡记录（供前端聚合统计）。"""
        with self.db_base.get_session() as session:
            query = (
                session.query(HabitRecord)
                .filter(HabitRecord.deleted_at.is_(None))
                .order_by(HabitRecord.record_date.desc())
                .limit(limit)
            )
            return [_record_to_dict(r) for r in query.all()]

    def get_record(self, habit_id: int, record_date: datetime) -> dict[str, Any] | None:
        with self.db_base.get_session() as session:
            record = (
                session.query(HabitRecord)
                .filter_by(habit_id=habit_id, record_date=record_date, deleted_at=None)
                .first()
            )
            return _record_to_dict(record) if record else None

    def add_record(self, habit_id: int, record_date: datetime) -> dict[str, Any]:
        with self.db_base.get_session() as session:
            record = HabitRecord(habit_id=habit_id, record_date=record_date)
            session.add(record)
            session.flush()
            result = _record_to_dict(record)
            session.commit()
            return result

    def remove_record(self, habit_id: int, record_date: datetime) -> bool:
        with self.db_base.get_session() as session:
            deleted = (
                session.query(HabitRecord)
                .filter_by(habit_id=habit_id, record_date=record_date, deleted_at=None)
                .delete(synchronize_session=False)
            )
            session.commit()
            return deleted > 0
