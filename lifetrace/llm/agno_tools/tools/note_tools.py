"""Note Management Tools

CRUD operations and search for notes (journals).
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from lifetrace.llm.agno_tools.base import get_message
from lifetrace.util.logging_config import get_logger

if TYPE_CHECKING:
	from lifetrace.services.journal_service import JournalService

logger = get_logger()


class NoteTools:
	"""Note management tools mixin"""

	lang: str
	journal_service: JournalService

	def _msg(self, key: str, **kwargs) -> str:
		return get_message(self.lang, key, **kwargs)

	def list_note_tags(self, limit: int = 500) -> str:
		"""List all unique tags currently used across existing notes.
		Use this BEFORE creating a note to see existing tags, so you can reuse them
		instead of always creating new tags.

		Args:
			limit: Maximum number of notes to scan (default: 500)

		Returns:
			Formatted list of existing note tags, sorted by frequency
		"""
		try:
			all_notes = self.journal_service.list_journals(
				limit=limit, offset=0, start_date=None, end_date=None
			)

			tag_counts: dict[str, int] = {}
			for note in all_notes.journals:
				for tag in note.tags or []:
					tag_counts[tag.tag_name] = tag_counts.get(tag.tag_name, 0) + 1

			if not tag_counts:
				return self._msg("note_tags_empty")

			sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)

			result = self._msg("note_tags_header", count=len(sorted_tags))
			for tag, count in sorted_tags:
				result += self._msg("note_tags_item", tag=tag, count=count) + "\n"

			return result.strip()

		except Exception as e:
			logger.error(f"Failed to list note tags: {e}")
			return self._msg("note_tags_failed", error=str(e))

	def create_note(
		self,
		name: str = "",
		user_notes: str = "",
		tags: str | None = None,
		date: str | None = None,
	) -> str:
		"""Create a new note

		Args:
			name: Note title (optional, defaults to current time)
			user_notes: Note content in markdown format (optional)
			tags: Comma-separated tags like 'work,meeting' (optional)
			date: Note date in ISO format like '2024-01-20' (optional, default: today)

		Returns:
			Success or failure message
		"""
		try:
			from lifetrace.schemas.journal import JournalCreate

			tag_list = []
			if tags:
				tag_list = [t.strip() for t in tags.split(",") if t.strip()]

			note_date = datetime.now()
			if date:
				try:
					parsed = datetime.fromisoformat(date)
					# 如果只传了纯日期（如 "2026-07-23"），用当前时间填充时间部分
					# 这样按 date DESC 排序时仍能保持正确顺序
					if parsed.hour == 0 and parsed.minute == 0 and parsed.second == 0 and parsed.microsecond == 0:
						note_date = note_date.replace(
							year=parsed.year, month=parsed.month, day=parsed.day
						)
					else:
						note_date = parsed
				except ValueError:
					pass

			if not name or not name.strip():
				name = note_date.strftime("%Y-%m-%d %H:%M")

			result = self.journal_service.create_journal(
				JournalCreate(
					name=name,
					user_notes=user_notes,
					tags=tag_list,
					date=note_date,
				)
			)
			return self._msg("note_create_success", id=result.id, name=name)

		except Exception as e:
			logger.error(f"Failed to create note: {e}")
			return self._msg("note_create_failed", error=str(e))

	def delete_note(self, note_id: int) -> str:
		"""Delete a note by ID

		Args:
			note_id: The ID of the note to delete

		Returns:
			Success or failure message
		"""
		try:
			self.journal_service.delete_journal(note_id)
			return self._msg("note_delete_success", id=note_id)

		except Exception as e:
			logger.error(f"Failed to delete note {note_id}: {e}")
			error_msg = str(e)
			if "404" in error_msg or "不存在" in error_msg:
				return self._msg("note_delete_not_found", id=note_id)
			return self._msg("note_delete_failed", error=error_msg)

	def update_note(
		self,
		note_id: int,
		name: str | None = None,
		user_notes: str | None = None,
		tags: str | None = None,
	) -> str:
		"""Update an existing note. Only provided fields are updated.

		Args:
			note_id: The ID of the note to update (required)
			name: New note title (optional)
			user_notes: New note content in markdown format (optional)
			tags: Comma-separated tags like 'work,meeting' (optional, overwrites existing tags)

		Returns:
			Success or failure message
		"""
		try:
			from lifetrace.schemas.journal import JournalUpdate

			update_data: dict = {}
			if name is not None:
				update_data["name"] = name
			if user_notes is not None:
				update_data["user_notes"] = user_notes
			if tags is not None:
				update_data["tags"] = [t.strip() for t in tags.split(",") if t.strip()]

			if not update_data:
				return self._msg("note_update_success", id=note_id)

			self.journal_service.update_journal(
				note_id, JournalUpdate(**update_data)
			)
			return self._msg("note_update_success", id=note_id)

		except Exception as e:
			logger.error(f"Failed to update note {note_id}: {e}")
			error_msg = str(e)
			if "404" in error_msg or "不存在" in error_msg:
				return self._msg("note_update_not_found", id=note_id)
			return self._msg("note_update_failed", error=error_msg)

	def search_notes(self, keyword: str, limit: int = 10) -> str:
		"""Search notes by keyword in title and content

		Args:
			keyword: Search keyword to match against note title and content
			limit: Maximum number of notes to return (default: 10)

		Returns:
			Formatted list of matching notes or empty message
		"""
		try:
			notes = self.journal_service.list_journals(
				limit=limit, offset=0, start_date=None, end_date=None, search=keyword
			)

			if not notes.journals:
				return self._msg("note_search_empty", keyword=keyword)

			result = self._msg(
				"note_search_header", keyword=keyword, count=notes.total
			)
			for note in notes.journals:
				tag_str = ", ".join(t.tag_name for t in (note.tags or []))
				result += (
					self._msg(
						"note_search_item",
						id=note.id,
						name=note.name,
						tags=tag_str or self._msg("note_no_tags"),
					)
					+ "\n"
				)

			return result.strip()

		except Exception as e:
			logger.error(f"Failed to search notes: {e}")
			return self._msg("note_search_empty", keyword=keyword)

	def list_notes_by_tags(self, tags: str, limit: int = 20) -> str:
		"""List notes filtered by tags

		Args:
			tags: Comma-separated tag names to filter by, e.g. 'work,meeting'
			limit: Maximum number of notes to return (default: 20)

		Returns:
			Formatted list of matching notes or empty message
		"""
		try:
			tag_list = [t.strip() for t in tags.split(",") if t.strip()]
			if not tag_list:
				return self._msg("note_list_by_tags_empty", tags=tags)

			all_notes = self.journal_service.list_journals(
				limit=max(200, limit), offset=0, start_date=None, end_date=None
			)

			matches = []
			for note in all_notes.journals:
				note_tags = {t.tag_name for t in (note.tags or [])}
				if any(tag in note_tags for tag in tag_list):
					matches.append(note)

			matches = matches[:limit]

			if not matches:
				return self._msg("note_list_by_tags_empty", tags=tags)

			result = self._msg(
				"note_list_by_tags_header", tags=tags, count=len(matches)
			)
			for note in matches:
				note_tag_str = ", ".join(
					t.tag_name for t in (note.tags or [])
				)
				result += (
					self._msg(
						"note_list_by_tags_item",
						id=note.id,
						name=note.name,
						date=note.date.strftime("%Y-%m-%d") if note.date else "?",
						tags=note_tag_str or self._msg("note_no_tags"),
					)
					+ "\n"
				)

			return result.strip()

		except Exception as e:
			logger.error(f"Failed to list notes by tags: {e}")
			return self._msg("note_list_by_tags_empty", tags=tags)

	def list_notes_by_date(
		self,
		start_date: str,
		end_date: str | None = None,
		limit: int = 20,
	) -> str:
		"""List notes within a date range

		Args:
			start_date: Start date in ISO format like '2024-01-01'
			end_date: End date in ISO format like '2024-01-31' (optional, default: start_date)
			limit: Maximum number of notes to return (default: 20)

		Returns:
			Formatted list of notes or empty message
		"""
		try:
			start = datetime.fromisoformat(start_date)

			if end_date:
				end = datetime.fromisoformat(end_date)
			else:
				end = start

			notes = self.journal_service.list_journals(
				limit=limit, offset=0, start_date=start, end_date=end
			)

			if not notes.journals:
				return self._msg("note_list_by_date_empty", start=start_date, end=end_date or start_date)

			result = self._msg(
				"note_list_by_date_header",
				start=start_date,
				end=end_date or start_date,
				count=notes.total,
			)
			for note in notes.journals:
				tag_str = ", ".join(t.tag_name for t in (note.tags or []))
				result += (
					self._msg(
						"note_list_by_date_item",
						id=note.id,
						name=note.name,
						date=note.date.strftime("%Y-%m-%d") if note.date else "?",
						tags=tag_str or self._msg("note_no_tags"),
					)
					+ "\n"
				)

			return result.strip()

		except Exception as e:
			logger.error(f"Failed to list notes by date: {e}")
			return self._msg("note_list_by_date_empty", start=start_date, end=end_date or start_date)

	def get_note(self, note_id: int) -> str:
		"""Get the FULL content of a note by ID (title, body, date, tags).
		Use this to read a note before updating it or inferring tags from its content.

		Args:
			note_id: The ID of the note to read

		Returns:
			The note's title, full content, date, and current tags
		"""
		try:
			note = self.journal_service.get_journal(note_id)
			tag_str = ", ".join(t.tag_name for t in (note.tags or []))
			return self._msg(
				"note_get_detail",
				id=note.id,
				name=note.name,
				content=note.user_notes or "",
				date=str(note.date),
				tags=tag_str or self._msg("note_no_tags"),
			)
		except Exception as e:
			logger.error(f"Failed to get note {note_id}: {e}")
			error_msg = str(e)
			if "404" in error_msg or "不存在" in error_msg:
				return self._msg("note_insight_not_found", id=note_id)
			return self._msg("note_get_failed", error=error_msg)

	def get_insight(self, note_id: int) -> str:
		"""Get AI insights for a note by finding similar and cross-domain notes

		Args:
			note_id: The ID of the note to get insights for

		Returns:
			Insight analysis with similar and cross-domain notes, or error message
		"""
		try:
			context = self.journal_service.get_insight_context(
				journal_id=note_id,
				similar_count=4,
				cross_domain_count=2,
			)

			current = context.get("current", {})
			similar = context.get("similar", [])
			cross_domain = context.get("cross_domain", [])

			result = self._msg(
				"note_insight_header",
				name=current.get("name", "?"),
			)

			if similar:
				result += self._msg("note_insight_similar_header", count=len(similar))
				for note in similar:
					tag_str = ", ".join(
						t.get("tag_name", "") for t in (note.get("tags") or [])
					)
					result += (
						self._msg(
							"note_insight_similar_item",
							id=note.get("id", "?"),
							name=note.get("name", "?"),
							tags=tag_str or self._msg("note_no_tags"),
						)
						+ "\n"
					)

			if cross_domain:
				result += self._msg(
					"note_insight_cross_domain_header", count=len(cross_domain)
				)
				for note in cross_domain:
					tag_str = ", ".join(
						t.get("tag_name", "") for t in (note.get("tags") or [])
					)
					result += (
						self._msg(
							"note_insight_cross_domain_item",
							id=note.get("id", "?"),
							name=note.get("name", "?"),
							tags=tag_str or self._msg("note_no_tags"),
						)
						+ "\n"
					)

			if not similar and not cross_domain:
				result += self._msg("note_insight_no_related")

			return result.strip()

		except Exception as e:
			logger.error(f"Failed to get insight for note {note_id}: {e}")
			error_msg = str(e)
			if "404" in error_msg or "不存在" in error_msg:
				return self._msg("note_insight_not_found", id=note_id)
			return self._msg("note_insight_failed", error=error_msg)

	def suggest_note_tags(self, note_id: int) -> str:
		"""Suggest tags for a note based on its FULL content, referencing the existing tag library.
		Reads the note content so suggestions match what the note actually says.
		This only SUGGESTS — to actually apply them, call update_note(tags=...).

		Args:
			note_id: The ID of the note to suggest tags for

		Returns:
			The note's title + content + the existing tag library + a suggestion guide
		"""
		try:
			note = self.journal_service.get_journal(note_id)
			all_notes = self.journal_service.list_journals(
				limit=500, offset=0, start_date=None, end_date=None
			)
			existing_tags = set()
			for n in all_notes.journals:
				for tag in n.tags or []:
					existing_tags.add(tag.tag_name)

			existing_tags_str = (
				", ".join(sorted(existing_tags)) if existing_tags else "None"
			)

			suggestion_guide = self._msg(
				"note_suggest_tags_guide",
				note_id=note.id,
				note_name=note.name,
				note_content=(note.user_notes or "")[:800],
				existing_tags=existing_tags_str,
			)
			return suggestion_guide

		except Exception as e:
			logger.error(f"Failed to get tag suggestion context: {e}")
			error_msg = str(e)
			if "404" in error_msg or "不存在" in error_msg:
				return self._msg("note_insight_not_found", id=note_id)
			return self._msg("note_suggest_tags_failed", error=error_msg)