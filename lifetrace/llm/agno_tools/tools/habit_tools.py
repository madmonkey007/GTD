"""Habit Management Tools

CRUD operations, search, and check-in records for habits.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from lifetrace.llm.agno_tools.base import get_message
from lifetrace.util.logging_config import get_logger

if TYPE_CHECKING:
	from lifetrace.services.habit_service import HabitService

logger = get_logger()


class HabitTools:
	"""Habit management tools mixin"""

	lang: str
	habit_service: HabitService

	def _msg(self, key: str, **kwargs) -> str:
		return get_message(self.lang, key, **kwargs)

	def create_habit(
		self,
		name: str,
		frequency: str = "daily",
		goal: str = "complete",
		icon: str = "✅",
		group: str = "allDay",
		persistence_days: int = 0,
		start_date: str | None = None,
	) -> str:
		"""Create a new habit.

		Args:
			name: Habit name (required), e.g. "跑步", "阅读".
			frequency: Frequency: daily/weekly/monthly (default daily).
			goal: Goal type: complete/participate (default complete).
			icon: Emoji icon (default ✅).
			group: Time group: morning/afternoon/evening/allDay (default allDay).
			persistence_days: Target persistence days (default 0).
			start_date: Start date YYYY-MM-DD (optional, default today).

		Returns:
			Success or failure message.
		"""
		try:
			from lifetrace.schemas.habit import HabitCreate

			parsed_start = None
			if start_date:
				try:
					parsed_start = datetime.fromisoformat(start_date)
				except ValueError:
					parsed_start = None
			result = self.habit_service.create_habit(
				HabitCreate(
					name=name,
					frequency=frequency,
					goal=goal,
					icon=icon,
					group=group,
					persistence_days=persistence_days,
					start_date=parsed_start,
				)
			)
			msg = self._msg("habit_create_success", id=result.id, name=result.name)
			self._record_write("habit", "create", True, id=result.id, name=result.name, message=msg)
			return msg
		except Exception as e:
			logger.error(f"Failed to create habit: {e}")
			err = self._msg("habit_create_failed", error=str(e))
			self._record_write("habit", "create", False, message=err)
			return err

	def update_habit(
		self,
		habit_id: int,
		name: str | None = None,
		frequency: str | None = None,
		goal: str | None = None,
		icon: str | None = None,
		group: str | None = None,
		persistence_days: int | None = None,
	) -> str:
		"""Update an existing habit. Only provided fields are changed.

		Args:
			habit_id: The habit id (required).
			name/frequency/goal/icon/group/persistence_days: optional fields to update.

		Returns:
			Success or failure message.
		"""
		try:
			from lifetrace.schemas.habit import HabitUpdate

			fields = {
				"name": name,
				"frequency": frequency,
				"goal": goal,
				"icon": icon,
				"group": group,
				"persistence_days": persistence_days,
			}
			updates = HabitUpdate(**{k: v for k, v in fields.items() if v is not None})
			result = self.habit_service.update_habit(habit_id, updates)
			msg = self._msg("habit_update_success", id=result.id, name=result.name)
			self._record_write("habit", "update", True, id=result.id, name=result.name, message=msg)
			return msg
		except Exception as e:
			logger.error(f"Failed to update habit: {e}")
			err = self._msg("habit_update_failed", error=str(e))
			self._record_write("habit", "update", False, id=habit_id, message=err)
			return err

	def delete_habit(self, habit_id: int) -> str:
		"""Delete a habit by id.

		Args:
			habit_id: The habit id (required).

		Returns:
			Success or failure message.
		"""
		try:
			self.habit_service.delete_habit(habit_id)
			msg = self._msg("habit_delete_success", id=habit_id)
			self._record_write("habit", "delete", True, id=habit_id, message=msg)
			return msg
		except Exception as e:
			logger.error(f"Failed to delete habit: {e}")
			err = self._msg("habit_delete_failed", error=str(e))
			self._record_write("habit", "delete", False, id=habit_id, message=err)
			return err

	def list_habits(self, limit: int = 50) -> str:
		"""List existing habits (newest first).

		Args:
			limit: Max number to return (default 50).

		Returns:
			Formatted habit list.
		"""
		try:
			data = self.habit_service.list_habits(limit=limit, offset=0, search=None)
			habits = data["habits"]
			if not habits:
				return self._msg("habit_list_empty")
			result = self._msg("habit_list_header", count=len(habits))
			for h in habits:
				result += self._msg(
					"habit_list_item",
					id=h["id"],
					name=h["name"],
					frequency=h["frequency"],
					icon=h.get("icon", "✅"),
				) + "\n"
			return result.strip()
		except Exception as e:
			logger.error(f"Failed to list habits: {e}")
			return self._msg("habit_list_failed", error=str(e))

	def search_habits(self, keyword: str) -> str:
		"""Search habits by name keyword.

		Args:
			keyword: Name substring to search (required).

		Returns:
			Formatted matching habit list.
		"""
		try:
			data = self.habit_service.list_habits(limit=50, offset=0, search=keyword)
			habits = data["habits"]
			if not habits:
				return self._msg("habit_search_empty", keyword=keyword)
			result = self._msg("habit_search_header", keyword=keyword, count=len(habits))
			for h in habits:
				result += self._msg(
					"habit_list_item",
					id=h["id"],
					name=h["name"],
					frequency=h["frequency"],
					icon=h.get("icon", "✅"),
				) + "\n"
			return result.strip()
		except Exception as e:
			logger.error(f"Failed to search habits: {e}")
			return self._msg("habit_search_failed", error=str(e))

	def toggle_habit_record(self, habit_id: int, date: str | None = None) -> str:
		"""Check in a habit for a date (idempotent toggle: if already checked in, cancels it).

		Args:
			habit_id: The habit id (required).
			date: Date YYYY-MM-DD (optional, default today).

		Returns:
			Message indicating checked-in or cancelled.
		"""
		try:
			record_date = None
			if date:
				try:
					record_date = datetime.fromisoformat(date)
				except ValueError:
					record_date = None
			if record_date is None:
				record_date = datetime.now()
			result = self.habit_service.toggle_record(habit_id, record_date)
			date_label = date or "today"
			if result["recorded"]:
				msg = self._msg("habit_checkin_success", id=habit_id, date=date_label)
				self._record_write(
					"habit", "checkin", True, id=habit_id, message=msg,
					extra={"date": date_label, "recorded": True},
				)
			else:
				msg = self._msg("habit_checkin_cancelled", id=habit_id, date=date_label)
				self._record_write(
					"habit", "cancel_checkin", True, id=habit_id, message=msg,
					extra={"date": date_label, "recorded": False},
				)
			return msg
		except Exception as e:
			logger.error(f"Failed to toggle habit record: {e}")
			err = self._msg("habit_checkin_failed", error=str(e))
			self._record_write("habit", "checkin", False, id=habit_id, message=err)
			return err

	def list_habit_records(self, habit_id: int, limit: int = 30) -> str:
		"""List recent check-in records for a habit.

		Args:
			habit_id: The habit id (required).
			limit: Max records to return (default 30).

		Returns:
			Formatted record list.
		"""
		try:
			records = self.habit_service.list_records(habit_id, limit=limit)
			if not records:
				return self._msg("habit_records_empty", id=habit_id)
			result = self._msg("habit_records_header", id=habit_id, count=len(records))
			for r in records:
				rd = r["record_date"]
				day = rd.strftime("%Y-%m-%d") if hasattr(rd, "strftime") else str(rd)
				result += self._msg("habit_records_item", date=day) + "\n"
			return result.strip()
		except Exception as e:
			logger.error(f"Failed to list habit records: {e}")
			return self._msg("habit_records_failed", error=str(e))
