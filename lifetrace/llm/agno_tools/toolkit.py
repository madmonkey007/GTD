"""FreeTodo Toolkit for Agno Agent

Main toolkit class that combines all tool mixins.
"""

from __future__ import annotations

import importlib

from agno.tools import Toolkit

from lifetrace.llm.agno_tools.base import AgnoToolsMessageLoader
from lifetrace.llm.agno_tools.tools import (
    BreakdownTools,
    ConflictTools,
    HabitTools,
    NoteTools,
    StatsTools,
    TagTools,
    TimeTools,
    TodoTools,
)
from lifetrace.util.logging_config import get_logger

logger = get_logger()


class FreeTodoToolkit(
    TodoTools,
    BreakdownTools,
    TimeTools,
    ConflictTools,
    StatsTools,
    TagTools,
    NoteTools,
    HabitTools,
    Toolkit,
):
    """FreeTodo Toolkit - Todo management tools for Agno Agent

    Combines all tool mixins into a single Toolkit.
    Supports internationalization through lang parameter.

    Tools included:
    - Todo CRUD: create_todo, complete_todo, update_todo, list_todos, search_todos, delete_todo
    - Task breakdown: breakdown_task
    - Time parsing: parse_time
    - Conflict detection: check_schedule_conflict
    - Statistics: get_todo_stats, get_overdue_todos
    - Tag management: list_tags, get_todos_by_tag, suggest_tags
    """

    def __init__(self, lang: str = "en", selected_tools: list[str] | None = None, **kwargs):
        """Initialize FreeTodoToolkit

        Args:
            lang: Language code for messages ('zh' or 'en'), defaults to 'en'
            selected_tools: List of tool names to enable. If None or empty, no tools are enabled.
            **kwargs: Additional arguments passed to Toolkit base class
        """
        self.lang = lang

        # 结构化写操作结果侧通道：写工具（增删改/完成/打卡）执行后追加一条结构化结果，
        # 供 stream adapter 在 run 结束时生成确定性「回执」作为最终回复（见 agno_agent._emit_final）。
        # 每次 AgnoAgentService 实例化都会新建一个 toolkit，故该列表天然按请求隔离。
        self.recent_write_results: list[dict] = []

        # Initialize message loader (preload messages)
        AgnoToolsMessageLoader(lang)

        # Lazy import to avoid circular dependencies
        repo_module = importlib.import_module("lifetrace.repositories.sql_todo_repository")
        db_module = importlib.import_module("lifetrace.storage.database")
        sql_todo_repository_class = repo_module.SqlTodoRepository
        db_base = db_module.db_base

        self.db_base = db_base
        self.todo_repo = sql_todo_repository_class(db_base)

        # Lazy import for JournalService
        journal_service_module = importlib.import_module("lifetrace.services.journal_service")
        journal_repo_module = importlib.import_module("lifetrace.repositories.sql_journal_repository")
        journal_repo_class = journal_repo_module.SqlJournalRepository
        self.journal_service = journal_service_module.JournalService(
            journal_repo_class(db_base), db_base
        )

        # Lazy import for HabitService
        habit_service_module = importlib.import_module("lifetrace.services.habit_service")
        habit_repo_module = importlib.import_module("lifetrace.repositories.sql_habit_repository")
        habit_repo_class = habit_repo_module.SqlHabitRepository
        self.habit_service = habit_service_module.HabitService(
            habit_repo_class(db_base), db_base
        )

        # All available tools
        all_tools = {
            # Todo management (from TodoTools)
            "create_todo": self.create_todo,
            "complete_todo": self.complete_todo,
            "update_todo": self.update_todo,
            "list_todos": self.list_todos,
            "search_todos": self.search_todos,
            "delete_todo": self.delete_todo,
            # Task breakdown (from BreakdownTools)
            "breakdown_task": self.breakdown_task,
            # Time parsing (from TimeTools)
            "parse_time": self.parse_time,
            # Conflict detection (from ConflictTools)
            "check_schedule_conflict": self.check_schedule_conflict,
            # Statistics (from StatsTools)
            "get_todo_stats": self.get_todo_stats,
            "get_overdue_todos": self.get_overdue_todos,
            # Tag management (from TagTools)
            "list_tags": self.list_tags,
            "get_todos_by_tag": self.get_todos_by_tag,
            "suggest_tags": self.suggest_tags,
            # Note management (from NoteTools)
            "create_note": self.create_note,
            "update_note": self.update_note,
            "delete_note": self.delete_note,
            "search_notes": self.search_notes,
            "get_note": self.get_note,
            "list_note_tags": self.list_note_tags,
            "list_notes_by_tags": self.list_notes_by_tags,
            "list_notes_by_date": self.list_notes_by_date,
            "get_insight": self.get_insight,
            "suggest_note_tags": self.suggest_note_tags,
            # Habit management (from HabitTools)
            "create_habit": self.create_habit,
            "update_habit": self.update_habit,
            "delete_habit": self.delete_habit,
            "list_habits": self.list_habits,
            "search_habits": self.search_habits,
            "toggle_habit_record": self.toggle_habit_record,
            "list_habit_records": self.list_habit_records,
        }

        # Filter tools based on selected_tools
        # Default: no tools enabled (user must explicitly select tools)
        if selected_tools and len(selected_tools) > 0:
            tools = [all_tools[tool_name] for tool_name in selected_tools if tool_name in all_tools]
            logger.info(
                f"FreeTodoToolkit initialized with lang={lang}, "
                f"selected {len(tools)} tools: {selected_tools}"
            )
        else:
            tools = []
            logger.info(f"FreeTodoToolkit initialized with lang={lang}, no tools enabled (default)")

        super().__init__(name="freetodo_toolkit", tools=tools, **kwargs)

    def _record_write(
        self,
        entity: str,
        action: str,
        ok: bool,
        *,
        id: int | None = None,
        name: str | None = None,
        message: str = "",
        extra: dict | None = None,
    ) -> None:
        """记录一次写操作的结构化结果，供后端生成最终回复回执。

        Args:
            entity: 实体类型（todo / note / habit）
            action: 动作（create / update / delete / complete / checkin / cancel_checkin）
            ok: 是否成功
            id: 实体 id（成功时）
            name: 实体名称（成功时）
            message: 面向用户的本地化文案（直接作为回执文本，复用工具已有 i18n 文案）
            extra: 额外字段（如打卡日期、是否新打卡）
        """
        entry: dict = {
            "ok": ok,
            "entity": entity,
            "action": action,
            "id": id,
            "name": name,
            "message": message,
        }
        if extra:
            entry.update(extra)
        self.recent_write_results.append(entry)
