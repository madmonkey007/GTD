"""Note Management Tools

CRUD operations and search for notes (journals).
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

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

    def create_note(
        self,
        name: str,
        user_notes: str = "",
        tags: str | None = None,
        date: str | None = None,
    ) -> str:
        """Create a new note

        Args:
            name: Note title (required)
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
                    note_date = datetime.fromisoformat(date)
                except ValueError:
                    pass

            result = self.journal_service.create_journal(
                JournalCreate(
                    name=name,
                    user_notes=user_notes,
                    tags=tag_list,
                    date=note_date,
                )
            )
            return self._msg("create_success", id=result.id, name=name)

        except Exception as e:
            logger.error(f"Failed to create note: {e}")
            return self._msg("create_failed", error=str(e))

    def delete_note(self, note_id: int) -> str:
        """Delete a note by ID

        Args:
            note_id: The ID of the note to delete

        Returns:
            Success or failure message
        """
        try:
            self.journal_service.delete_journal(note_id)
            return self._msg("delete_success", id=note_id)

        except Exception as e:
            logger.error(f"Failed to delete note {note_id}: {e}")
            error_msg = str(e)
            if "404" in error_msg or "不存在" in error_msg:
                return self._msg("delete_not_found", id=note_id)
            return self._msg("delete_failed", error=error_msg)

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
                limit=limit, offset=0, search=keyword
            )

            if not notes.journals:
                return self._msg("search_empty", keyword=keyword)

            result = self._msg(
                "search_header", keyword=keyword, count=notes.total
            )
            for note in notes.journals:
                tag_str = ", ".join(t.tag_name for t in (note.tags or []))
                result += (
                    self._msg(
                        "search_item",
                        id=note.id,
                        name=note.name,
                        tags=tag_str or self._msg("no_tags"),
                    )
                    + "\n"
                )

            return result.strip()

        except Exception as e:
            logger.error(f"Failed to search notes: {e}")
            return self._msg("search_empty", keyword=keyword)

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
                return self._msg("list_by_tags_empty", tags=tags)

            all_notes = self.journal_service.list_journals(
                limit=max(200, limit), offset=0
            )

            matches = []
            for note in all_notes.journals:
                note_tags = {t.tag_name for t in (note.tags or [])}
                if any(tag in note_tags for tag in tag_list):
                    matches.append(note)

            matches = matches[:limit]

            if not matches:
                return self._msg("list_by_tags_empty", tags=tags)

            result = self._msg(
                "list_by_tags_header", tags=tags, count=len(matches)
            )
            for note in matches:
                note_tag_str = ", ".join(
                    t.tag_name for t in (note.tags or [])
                )
                result += (
                    self._msg(
                        "list_by_tags_item",
                        id=note.id,
                        name=note.name,
                        date=note.date.strftime("%Y-%m-%d") if note.date else "?",
                        tags=note_tag_str or self._msg("no_tags"),
                    )
                    + "\n"
                )

            return result.strip()

        except Exception as e:
            logger.error(f"Failed to list notes by tags: {e}")
            return self._msg("list_by_tags_empty", tags=tags)

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
                return self._msg("list_by_date_empty", start=start_date, end=end_date or start_date)

            result = self._msg(
                "list_by_date_header",
                start=start_date,
                end=end_date or start_date,
                count=notes.total,
            )
            for note in notes.journals:
                tag_str = ", ".join(t.tag_name for t in (note.tags or []))
                result += (
                    self._msg(
                        "list_by_date_item",
                        id=note.id,
                        name=note.name,
                        date=note.date.strftime("%Y-%m-%d") if note.date else "?",
                        tags=tag_str or self._msg("no_tags"),
                    )
                    + "\n"
                )

            return result.strip()

        except Exception as e:
            logger.error(f"Failed to list notes by date: {e}")
            return self._msg("list_by_date_empty", start=start_date, end=end_date or start_date)

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
                "insight_header",
                name=current.get("name", "?"),
            )

            if similar:
                result += self._msg("insight_similar_header", count=len(similar))
                for note in similar:
                    tag_str = ", ".join(
                        t.get("tag_name", "") for t in (note.get("tags") or [])
                    )
                    result += (
                        self._msg(
                            "insight_similar_item",
                            id=note.get("id", "?"),
                            name=note.get("name", "?"),
                            tags=tag_str or self._msg("no_tags"),
                        )
                        + "\n"
                    )

            if cross_domain:
                result += self._msg(
                    "insight_cross_domain_header", count=len(cross_domain)
                )
                for note in cross_domain:
                    tag_str = ", ".join(
                        t.get("tag_name", "") for t in (note.get("tags") or [])
                    )
                    result += (
                        self._msg(
                            "insight_cross_domain_item",
                            id=note.get("id", "?"),
                            name=note.get("name", "?"),
                            tags=tag_str or self._msg("no_tags"),
                        )
                        + "\n"
                    )

            if not similar and not cross_domain:
                result += self._msg("insight_no_related")

            return result.strip()

        except Exception as e:
            logger.error(f"Failed to get insight for note {note_id}: {e}")
            error_msg = str(e)
            if "404" in error_msg or "不存在" in error_msg:
                return self._msg("insight_not_found", id=note_id)
            return self._msg("insight_failed", error=error_msg)

    def suggest_note_tags(self, note_name: str) -> str:
        """Suggest tags based on note name, referencing existing tags from all notes

        Args:
            note_name: Name of the note to suggest tags for

        Returns:
            Instructions for the Agent to suggest tags directly
        """
        try:
            all_notes = self.journal_service.list_journals(
                limit=500, offset=0
            )
            existing_tags = set()
            for note in all_notes.journals:
                for tag in note.tags or []:
                    existing_tags.add(tag.tag_name)

            existing_tags_str = (
                ", ".join(sorted(existing_tags)) if existing_tags else "None"
            )

            suggestion_guide = self._msg(
                "suggest_tags_guide",
                note_name=note_name,
                existing_tags=existing_tags_str,
            )
            return suggestion_guide

        except Exception as e:
            logger.error(f"Failed to get tag suggestion context: {e}")
            return self._msg("suggest_tags_failed", error=str(e))