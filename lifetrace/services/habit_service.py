"""习惯服务 - 业务逻辑层"""

from datetime import datetime
from typing import Any

from fastapi import HTTPException

from lifetrace.repositories.sql_habit_repository import SqlHabitRepository
from lifetrace.schemas.habit import (
    HabitCreate,
    HabitResponse,
    HabitUpdate,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()

# 合法的枚举取值
_VALID_FREQUENCY = {"daily", "weekly", "monthly"}
_VALID_GOAL = {"complete", "participate"}
_VALID_GROUP = {"morning", "afternoon", "evening", "allDay"}


def _to_response(habit: dict[str, Any]) -> HabitResponse:
    return HabitResponse(
        id=habit["id"],
        uid=habit["uid"],
        name=habit["name"],
        icon=habit.get("icon", "✅"),
        frequency=habit.get("frequency", "daily"),
        goal=habit.get("goal", "complete"),
        start_date=habit.get("start_date"),
        persistence_days=habit.get("persistence_days", 0),
        group=habit.get("group", "allDay"),
        created_at=habit["created_at"],
        updated_at=habit["updated_at"],
    )


def _normalize_record_date(value: datetime) -> datetime:
    """把日期归一到当天 00:00（naive），保证打卡按天幂等。"""
    if value.tzinfo is not None:
        value = value.astimezone().replace(tzinfo=None)
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


class HabitService:
    """习惯业务服务"""

    def __init__(self, repository: SqlHabitRepository, db_base: Any = None):
        self.repository = repository
        self.db_base = db_base

    def _validate_enums(self, *, frequency=None, goal=None, group=None) -> None:
        if frequency is not None and frequency not in _VALID_FREQUENCY:
            raise HTTPException(status_code=422, detail=f"非法 frequency: {frequency}")
        if goal is not None and goal not in _VALID_GOAL:
            raise HTTPException(status_code=422, detail=f"非法 goal: {goal}")
        if group is not None and group not in _VALID_GROUP:
            raise HTTPException(status_code=422, detail=f"非法 group: {group}")

    def create_habit(self, data: HabitCreate) -> HabitResponse:
        self._validate_enums(frequency=data.frequency, goal=data.goal, group=data.group)
        if data.uid:
            existing = self.repository.get_by_uid(data.uid)
            if existing:
                return _to_response(existing)
        fields = {
            **({"uid": data.uid} if data.uid else {}),
            "name": data.name,
            "icon": data.icon,
            "frequency": data.frequency,
            "goal": data.goal,
            "start_date": data.start_date,
            "persistence_days": data.persistence_days,
            "group": data.group,
        }
        created = self.repository.create(fields)
        return _to_response(created)

    def update_habit(self, habit_id: int, data: HabitUpdate) -> HabitResponse:
        existing = self.repository.get_by_id(habit_id)
        if not existing:
            raise HTTPException(status_code=404, detail="习惯不存在")
        fields = data.model_dump(exclude_unset=True)
        self._validate_enums(
            frequency=fields.get("frequency"),
            goal=fields.get("goal"),
            group=fields.get("group"),
        )
        if not fields:
            return _to_response(existing)
        updated = self.repository.update(habit_id, fields)
        return _to_response(updated or existing)

    def delete_habit(self, habit_id: int) -> None:
        if not self.repository.delete(habit_id):
            raise HTTPException(status_code=404, detail="习惯不存在")

    def get_habit(self, habit_id: int) -> HabitResponse:
        habit = self.repository.get_by_id(habit_id)
        if not habit:
            raise HTTPException(status_code=404, detail="习惯不存在")
        return _to_response(habit)

    def list_habits(
        self, limit: int = 100, offset: int = 0, search: str | None = None
    ) -> dict[str, Any]:
        habits = self.repository.list_habits(limit=limit, offset=offset, search=search)
        total = self.repository.count(search=search)
        return {"total": total, "habits": [_to_response(h).model_dump() for h in habits]}

    # ---- 打卡 ----

    def toggle_record(self, habit_id: int, record_date: datetime) -> dict[str, Any]:
        """幂等打卡：当天已有记录则取消，否则新增。"""
        if not self.repository.get_by_id(habit_id):
            raise HTTPException(status_code=404, detail="习惯不存在")
        normalized = _normalize_record_date(record_date)
        existing = self.repository.get_record(habit_id, normalized)
        if existing:
            self.repository.remove_record(habit_id, normalized)
            return {"recorded": False, "record": None}
        record = self.repository.add_record(habit_id, normalized)
        return {"recorded": True, "record": record}

    def list_records(self, habit_id: int, limit: int = 100) -> list[dict[str, Any]]:
        if not self.repository.get_by_id(habit_id):
            raise HTTPException(status_code=404, detail="习惯不存在")
        return self.repository.list_records(habit_id, limit=limit)

    def list_all_records(self, limit: int = 5000) -> list[dict[str, Any]]:
        """所有习惯的打卡记录（聚合用）。"""
        return self.repository.list_all_records(limit=limit)
