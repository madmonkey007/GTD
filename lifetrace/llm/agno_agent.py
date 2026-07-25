"""Agno Agent 服务，基于 Agno 框架的通用 Agent 实现

支持 FreeTodoToolkit 工具集和国际化消息。
支持工具调用事件流，可在前端实时展示 Agent 执行步骤。
支持 Phoenix + OpenInference 观测（通过配置启用）。
支持 session_id 传递，实现按会话聚合 trace 文件。
支持外部工具（如 DuckDuckGo 搜索）。
"""

from __future__ import annotations

import importlib
import inspect
import json
from contextvars import ContextVar
from pathlib import Path
from typing import TYPE_CHECKING

from agno.agent import Agent, Message, RunEvent
from agno.models.openai.like import OpenAILike

from lifetrace.llm.agno_tools import FreeTodoToolkit
from lifetrace.llm.agno_tools.base import get_message
from lifetrace.observability import setup_observability
from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings

if TYPE_CHECKING:
    from collections.abc import Generator

    from agno.tools import Toolkit

# 全局 ContextVar 用于跨 span 传递 session_id
# file_exporter 可以读取这个值来按 session 聚合文件
current_session_id: ContextVar[str | None] = ContextVar("current_session_id", default=None)

logger = get_logger()

# 初始化观测系统（在模块加载时执行一次）
# 如果配置中 observability.enabled = false，则不会有任何影响
setup_observability()

# Default language, can be overridden from settings
DEFAULT_LANG = "en"

# 工具调用事件标记（用于流式输出中区分内容和工具调用事件）
TOOL_EVENT_PREFIX = "\n[TOOL_EVENT:"
TOOL_EVENT_SUFFIX = "]\n"

# 最终回复标记：由后端在 run 结束时注入**唯一**一次，承载权威的「最终回复」。
# source: "tool_result"（写操作回执）/ "model_content"（无写操作的终态正文）/ "error"（空回复兜底）。
# 前端只把 [FINAL] 渲染为最终回复，执行过程（思考/工具/中间正文）与此分离，杜绝从前端猜测。
FINAL_PREFIX = "\n[FINAL:"
FINAL_SUFFIX = "]\n"

# 工具结果预览最大长度
RESULT_PREVIEW_MAX_LENGTH = 500

# 可用的外部工具映射
EXTERNAL_TOOLS_REGISTRY: dict[str, type[Toolkit]] = {}


def _try_register_tool(name: str, module_path: str, class_name: str, warning: str = ""):
    """尝试注册单个工具"""
    try:
        module = importlib.import_module(module_path)
        tool_class = getattr(module, class_name)
        EXTERNAL_TOOLS_REGISTRY[name] = tool_class
        logger.debug(f"已注册外部工具: {name}")
    except ImportError:
        logger.warning(warning or f"无法导入 {class_name}")


def _ensure_tool_dependency(tool_name: str, package_name: str) -> bool:
    """检查外部工具依赖是否可用"""
    try:
        importlib.import_module(package_name)
    except ImportError:
        logger.warning(f"{tool_name} 工具依赖 {package_name} 包，未安装，跳过注册")
        return False
    return True


def _register_external_tools():
    """注册可用的外部工具（延迟导入以避免启动时的依赖问题）"""
    if EXTERNAL_TOOLS_REGISTRY:
        return

    # 工具注册配置: (名称, 模块路径, 类名, 警告信息, 依赖包)
    tools_config = [
        # 搜索类工具
        ("websearch", "agno.tools.websearch", "WebSearchTools", "请确保已安装 ddgs 包", "ddgs"),
        ("hackernews", "agno.tools.hackernews", "HackerNewsTools", "", None),
        # 本地工具
        ("file", "agno.tools.file", "FileTools", "", None),
        ("local_fs", "agno.tools.local_file_system", "LocalFileSystemTools", "", None),
        ("shell", "agno.tools.shell", "ShellTools", "", None),
        ("sleep", "agno.tools.sleep", "SleepTools", "", None),
    ]

    for name, module_path, class_name, warning, dependency in tools_config:
        if dependency and not _ensure_tool_dependency(name, dependency):
            continue
        _try_register_tool(name, module_path, class_name, warning)


def get_available_external_tools() -> list[str]:
    """获取可用的外部工具列表"""
    _register_external_tools()
    return list(EXTERNAL_TOOLS_REGISTRY.keys())


def _create_file_tool(tool_class, **kwargs) -> Toolkit | None:
    """创建 FileTools 实例"""
    base_dir = kwargs.get("base_dir")
    if not base_dir:
        logger.warning("FileTools 需要 base_dir 参数，跳过创建")
        return None
    # FileTools 需要 Path 对象，而不是字符串
    base_dir_path = Path(base_dir) if isinstance(base_dir, str) else base_dir
    return tool_class(
        base_dir=base_dir_path,
        enable_save_file=True,
        enable_read_file=True,
        enable_read_file_chunk=True,
        enable_replace_file_chunk=True,
        enable_list_files=True,
        enable_search_files=True,
        enable_delete_file=kwargs.get("enable_delete", False),
    )


def _safe_tool_init(tool_class, **kwargs) -> Toolkit:
    """安全初始化工具，兼容不同版本的构造参数"""
    try:
        return tool_class(**kwargs)
    except TypeError as exc:
        if "unexpected keyword argument" not in str(exc):
            raise
        try:
            sig = inspect.signature(tool_class.__init__)
        except (TypeError, ValueError):
            return tool_class()
        allowed_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}
        if not allowed_kwargs:
            return tool_class()
        return tool_class(**allowed_kwargs)


def create_external_tool(tool_name: str, **kwargs) -> Toolkit | None:  # noqa: PLR0911
    """创建外部工具实例

    可用工具:
        搜索类: websearch, hackernews
        本地类: file(需要base_dir), local_fs, shell, sleep
    """
    _register_external_tools()
    tool_class = EXTERNAL_TOOLS_REGISTRY.get(tool_name)
    if not tool_class:
        return None

    base_dir = kwargs.get("base_dir")

    # 搜索类工具
    if tool_name == "websearch":
        return _safe_tool_init(tool_class, backend="auto", search=True, news=True)
    if tool_name in ("hackernews", "sleep"):
        return _safe_tool_init(tool_class)

    # 本地工具
    if tool_name == "file":
        return _create_file_tool(tool_class, **kwargs)
    if tool_name == "local_fs":
        # 确保使用 Path 对象
        base_dir_path = Path(base_dir) if isinstance(base_dir, str) else base_dir
        return (
            _safe_tool_init(tool_class, target_directory=base_dir_path)
            if base_dir
            else _safe_tool_init(tool_class)
        )
    if tool_name == "shell":
        # 确保使用 Path 对象
        base_dir_path = Path(base_dir) if isinstance(base_dir, str) else base_dir
        return (
            _safe_tool_init(tool_class, base_dir=base_dir_path)
            if base_dir
            else _safe_tool_init(tool_class)
        )

    return _safe_tool_init(tool_class)


# 笔记工具名集合：用于判断是否启用笔记能力，进而选择对应的 instructions
NOTE_TOOL_NAMES = {
	"create_note",
	"update_note",
	"delete_note",
	"search_notes",
	"list_notes_by_tags",
	"list_notes_by_date",
	"get_insight",
	"suggest_note_tags",
}

# 习惯工具名集合
HABIT_TOOL_NAMES = {
	"create_habit",
	"update_habit",
	"delete_habit",
	"list_habits",
	"search_habits",
	"toggle_habit_record",
	"list_habit_records",
}

# 待办工具名集合（用于识别「智能指令」面板的三类齐全场景）
TODO_TOOL_NAMES = {
	"create_todo",
	"update_todo",
	"delete_todo",
	"list_todos",
	"search_todos",
	"complete_todo",
}


def _build_instructions(
	lang: str,
	has_tools: bool,
	use_all_freetodo_tools: bool,
	has_external_tools: bool,
	selected_tools: list[str] | None = None,
) -> list[str] | None:
	"""构建 Agent 的 instructions

	Args:
		lang: 语言代码
		has_tools: 是否有任何工具启用
		use_all_freetodo_tools: 是否使用全部 FreeTodo 工具
		has_external_tools: 是否有外部工具
		selected_tools: 实际选中的工具名列表（用于按需切换 instructions）

	Returns:
		instructions 列表或 None
	"""
	if has_tools:
		# 按启用工具类别选择 instructions：
		# - 智能指令面板（待办+笔记+习惯三类齐全）→ 路由指令
		# - 仅习惯工具 → 习惯指令
		# - 含笔记工具 → 笔记指令
		# - 其它 → 通用指令
		has_note_tools = bool(selected_tools and set(selected_tools) & NOTE_TOOL_NAMES)
		has_habit_tools = bool(selected_tools and set(selected_tools) & HABIT_TOOL_NAMES)
		has_todo_tools = bool(selected_tools and set(selected_tools) & TODO_TOOL_NAMES)
		if has_todo_tools and has_note_tools and has_habit_tools:
			key = "quick_command_instructions"
		elif has_habit_tools:
			key = "habits_instructions"
		elif has_note_tools:
			key = "notes_instructions"
		else:
			key = "instructions"
		instructions = get_message(lang, key)
		if instructions and instructions != f"[{key}]":
			return [instructions]
		# 回退到通用 instructions
		instructions = get_message(lang, "instructions")
		if instructions and instructions != "[instructions]":
			return [instructions]

	# 简化的 instructions（无工具时）
	if lang == "zh":
		return ["你是 FreeTodo 智能助手。当前没有启用任何工具，请直接回答用户的问题。"]

	# English
	return [
		"You are the FreeTodo assistant. No tools are currently enabled. "
		"Please answer the user's questions directly."
	]


class AgnoAgentService:
    """Agno Agent 服务，提供基于 Agno 框架的智能对话能力

    Supports:
    - FreeTodoToolkit for todo management
    - External tools (DuckDuckGo search, etc.)
    - Internationalization (i18n) through lang parameter
    - Streaming responses
    """

    def __init__(
        self,
        lang: str | None = None,
        selected_tools: list[str] | None = None,
        external_tools: list[str] | None = None,
        external_tools_config: dict[str, dict] | None = None,
    ):
        """初始化 Agno Agent 服务

        Args:
            lang: Language code for messages ('zh' or 'en').
                  If None, uses DEFAULT_LANG or settings default.
            selected_tools: List of FreeTodo tool names to enable.
                           If None or empty, no FreeTodo tools are enabled.
            external_tools: List of external tool names to enable (e.g., ['duckduckgo', 'file']).
                           If None or empty, no external tools are enabled.
            external_tools_config: Configuration dict for external tools.
                           Example: {"file": {"base_dir": "/path/to/workspace", "enable_delete": False}}
        """
        try:
            self.lang = lang or DEFAULT_LANG
            # 思考过程合并状态：跨 chunk 跟踪，避免每个 reasoning token 都包一层 [THINK]
            self._in_thinking = False
            # FreeTodoToolkit 实例（若有），用于在 run 结束时读取 recent_write_results 生成回执
            self.toolkit = None
            tools_to_use = self._initialize_tools(
                selected_tools, external_tools, external_tools_config
            )

            # 判断工具配置
            total_freetodo_tools_count = 21
            use_all_freetodo_tools = bool(
                selected_tools and len(selected_tools) == total_freetodo_tools_count
            )
            has_external_tools = bool(external_tools and len(external_tools) > 0)

            instructions_list = _build_instructions(
                self.lang,
				bool(tools_to_use),
				use_all_freetodo_tools,
				has_external_tools,
				selected_tools,
            )

            self.agent = Agent(
                model=OpenAILike(
                    id=settings.llm.model,
                    api_key=settings.llm.api_key,
                    base_url=settings.llm.base_url,
                ),
                tools=tools_to_use if tools_to_use else None,
                instructions=instructions_list,
                markdown=True,
            )
            logger.info(
                f"Agno Agent 初始化成功，模型: {settings.llm.model}, "
                f"Base URL: {settings.llm.base_url}, lang: {self.lang}, "
                f"工具数量: {len(tools_to_use)}",
            )
        except Exception as e:
            logger.error(f"Agno Agent 初始化失败: {e}")
            raise

    def _initialize_tools(
        self,
        selected_tools: list[str] | None,
        external_tools: list[str] | None,
        external_tools_config: dict[str, dict] | None = None,
    ) -> list[Toolkit]:
        """初始化工具列表

        Args:
            selected_tools: FreeTodo 工具名称列表
            external_tools: 外部工具名称列表
            external_tools_config: 外部工具配置字典，如 {"file": {"base_dir": "/path"}}
        """
        tools_to_use: list[Toolkit] = []
        external_tools_config = external_tools_config or {}

        # Initialize FreeTodoToolkit if any tools are selected
        if selected_tools and len(selected_tools) > 0:
            toolkit = FreeTodoToolkit(lang=self.lang, selected_tools=selected_tools)
            self.toolkit = toolkit
            tools_to_use.append(toolkit)
            logger.info(f"已启用 FreeTodo 工具: {selected_tools}")

        # Initialize external tools with config
        if external_tools and len(external_tools) > 0:
            for tool_name in external_tools:
                # 获取该工具的配置
                config = external_tools_config.get(tool_name, {})
                external_tool = create_external_tool(tool_name, **config)
                if external_tool:
                    tools_to_use.append(external_tool)
                    logger.info(f"已启用外部工具: {tool_name}, 配置: {config}")
                else:
                    logger.warning(f"未找到或无法创建外部工具: {tool_name}")

        return tools_to_use

    def _build_input_data(
        self,
        message: str,
        conversation_history: list[dict[str, str]] | None,
    ):
        """构建 Agent 输入数据"""
        if not conversation_history:
            return message

        messages = []
        for msg in conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant"):
                messages.append(Message(role=role, content=content))
        messages.append(Message(role="user", content=message))
        return messages

    def _format_tool_event(self, event_data: dict) -> str:
        """格式化工具事件为输出字符串"""
        return f"{TOOL_EVENT_PREFIX}{json.dumps(event_data, ensure_ascii=False)}{TOOL_EVENT_SUFFIX}"

    def _handle_tool_call_started(self, chunk) -> str | None:
        """处理工具调用开始事件"""
        tool_info = getattr(chunk, "tool", None)
        if not tool_info:
            return None
        event_data = {
            "type": "tool_call_start",
            "tool_name": getattr(tool_info, "tool_name", "unknown"),
            "tool_args": getattr(tool_info, "tool_args", {}),
        }
        logger.debug(f"工具调用开始: {event_data['tool_name']}, 参数: {event_data['tool_args']}")
        return self._format_tool_event(event_data)

    def _handle_tool_call_completed(self, chunk) -> str | None:
        """处理工具调用完成事件"""
        tool_info = getattr(chunk, "tool", None)
        if not tool_info:
            return None
        result = getattr(tool_info, "result", "")
        result_str = str(result)
        result_preview = (
            result_str[:RESULT_PREVIEW_MAX_LENGTH] + "..."
            if len(result_str) > RESULT_PREVIEW_MAX_LENGTH
            else result_str
        )
        event_data = {
            "type": "tool_call_end",
            "tool_name": getattr(tool_info, "tool_name", "unknown"),
            "result_preview": result_preview,
        }
        logger.debug(
            f"工具调用完成: {event_data['tool_name']}, 结果预览: {result_preview[:100]}..."
        )
        return self._format_tool_event(event_data)

    def _handle_tool_call_error(self, chunk) -> str | None:
        """处理工具调用错误事件"""
        tool_info = getattr(chunk, "tool", None)
        if not tool_info:
            return None
        error = getattr(tool_info, "error", None) or getattr(chunk, "error", None)
        error_str = str(error) if error else "Unknown error"
        error_preview = (
            error_str[:RESULT_PREVIEW_MAX_LENGTH] + "..."
            if len(error_str) > RESULT_PREVIEW_MAX_LENGTH
            else error_str
        )
        event_data = {
            "type": "tool_call_end",
            "tool_name": getattr(tool_info, "tool_name", "unknown"),
            "result_preview": f"[Error] {error_preview}",
            "error": True,
        }
        logger.warning(f"工具调用错误: {event_data['tool_name']}, 错误: {error_preview[:100]}...")
        return self._format_tool_event(event_data)

    def _process_stream_chunk(self, chunk, include_tool_events: bool) -> str | None:
        """处理单个流式输出块，返回需要 yield 的内容"""
        result = None

        if chunk.event == RunEvent.run_content:
            parts = []
            # 提取 reasoning_content（DeepSeek 的思考过程）
            # 合并连续的 reasoning 到同一个 [THINK]...[/THINK] 块，
            # 避免每个 SSE chunk 都包一层导致前端渲染出几十个折叠块
            reasoning = getattr(chunk, "reasoning_content", None)
            has_content = bool(chunk.content)
            if reasoning:
                if not self._in_thinking:
                    parts.append("[THINK]")
                    self._in_thinking = True
                parts.append(reasoning)
                # 同一 chunk 同时带正文：先闭合思考块再输出正文
                if has_content:
                    parts.append("[/THINK]")
                    self._in_thinking = False
                    parts.append(chunk.content)
            else:
                # 没有推理内容：若之前在思考中，先闭合
                if self._in_thinking:
                    parts.append("[/THINK]")
                    self._in_thinking = False
                if has_content:
                    parts.append(chunk.content)
            if parts:
                result = "".join(parts)
        elif include_tool_events:
            if chunk.event == RunEvent.tool_call_started:
                result = self._handle_tool_call_started(chunk)
            elif chunk.event == RunEvent.tool_call_completed:
                result = self._handle_tool_call_completed(chunk)
            elif chunk.event == RunEvent.tool_call_error:
                # 处理工具调用错误事件，发送 tool_call_end 以便前端更新状态
                result = self._handle_tool_call_error(chunk)
            elif chunk.event == RunEvent.run_started:
                logger.debug("Agent 运行开始")
                result = self._format_tool_event({"type": "run_started"})
            elif chunk.event == RunEvent.run_completed:
                logger.debug("Agent 运行完成")
                result = self._format_tool_event({"type": "run_completed"})

        return result

    def _render_receipt(self, write_results: list[dict]) -> str:
        """把结构化写操作结果渲染成回执文本（复用各工具已本地化的 message 文案）。"""
        lines: list[str] = []
        for r in write_results:
            msg = r.get("message")
            if msg:
                lines.append(str(msg).strip())
        return "\n".join(lines).strip()

    def _build_final_payload(
        self, content_buffer: list[str]
    ) -> dict:
        """run 结束时决定最终回复的来源与文本。

        - 有写操作结果 → 回执（source=tool_result），模型终态正文被丢弃（用回执替代模型复述）。
        - 否则 → 模型终态正文（source=model_content）；为空则受控兜底（source=error）。
        reasoning 永不进入最终回复。
        """
        write_results = (
            list(getattr(self.toolkit, "recent_write_results", []))
            if self.toolkit is not None
            else []
        )
        terminal = "".join(content_buffer).strip()

        if write_results:
            receipt = self._render_receipt(write_results)
            text = receipt if receipt else (terminal or "")
            source = "tool_result"
        else:
            text = terminal
            source = "model_content"

        if not text:
            text = (
                "（未生成回复，请重试。）"
                if self.lang == "zh"
                else "(No reply generated. Please retry.)"
            )
            source = "error"

        return {"type": "final", "source": source, "text": text}

    def stream_response(
        self,
        message: str,
        conversation_history: list[dict[str, str]] | None = None,
        include_tool_events: bool = True,
        session_id: str | None = None,
    ) -> Generator[str]:
        """
        流式生成 Agent 回复。

        协议（内联文本，前端解析）：
        - [THINK]...[/THINK]：推理过程（执行过程）。
        - [TOOL_EVENT:{...}]：工具调用开始/结束事件（执行过程）。
        - 模型正文：在**两次工具调用之间**的部分作为「中间正文」立即 yield（执行过程）；
          最后一次工具调用之后的终态正文先缓冲，run 结束时作为 [FINAL] 的 model_content。
        - [FINAL:{...}]：run 结束时注入**唯一**一次，承载权威最终回复（写操作=回执，否则=终态正文）。
        """
        # 设置本地 ContextVar（用于 file_exporter 按会话聚合）
        current_session_id.set(session_id)

        # 终态正文缓冲：仅在「最后一次工具调用之后」累积的内容，作为最终回复候选。
        content_buffer: list[str] = []
        self._in_thinking = False

        try:
            input_data = self._build_input_data(message, conversation_history)
            stream = self.agent.run(
                input_data,
                stream=True,
                stream_events=include_tool_events,
                session_id=session_id,
            )

            for chunk in stream:
                ev = chunk.event
                if ev == RunEvent.run_content:
                    reasoning = getattr(chunk, "reasoning_content", None)
                    has_content = bool(chunk.content)
                    parts: list[str] = []
                    if reasoning:
                        if not self._in_thinking:
                            parts.append("[THINK]")
                            self._in_thinking = True
                        parts.append(reasoning)
                        if has_content:
                            parts.append("[/THINK]")
                            self._in_thinking = False
                            content_buffer.append(chunk.content)
                    else:
                        if self._in_thinking:
                            parts.append("[/THINK]")
                            self._in_thinking = False
                        if has_content:
                            content_buffer.append(chunk.content)
                    if parts:
                        yield "".join(parts)
                elif ev == RunEvent.tool_call_started:
                    # 新工具开始 → 之前缓冲的正文属于「中间正文」，落盘到执行过程
                    if content_buffer:
                        yield "".join(content_buffer)
                        content_buffer = []
                    out = (
                        self._handle_tool_call_started(chunk)
                        if include_tool_events
                        else None
                    )
                    if out:
                        yield out
                elif ev == RunEvent.tool_call_completed:
                    out = (
                        self._handle_tool_call_completed(chunk)
                        if include_tool_events
                        else None
                    )
                    if out:
                        yield out
                elif ev == RunEvent.tool_call_error:
                    out = (
                        self._handle_tool_call_error(chunk)
                        if include_tool_events
                        else None
                    )
                    if out:
                        yield out
                elif ev == RunEvent.run_started:
                    if include_tool_events:
                        yield self._format_tool_event({"type": "run_started"})
                elif ev == RunEvent.run_completed:
                    # 最终回复在循环结束后统一注入
                    pass
                else:
                    out = self._process_stream_chunk(chunk, include_tool_events)
                    if out:
                        yield out

            # ---- run 结束：注入唯一 [FINAL] ----
            if self._in_thinking:
                yield "[/THINK]"
                self._in_thinking = False
            payload = self._build_final_payload(content_buffer)
            yield f"{FINAL_PREFIX}{json.dumps(payload, ensure_ascii=False)}{FINAL_SUFFIX}"

        except Exception as e:
            logger.error(f"Agno Agent 流式生成失败: {e}")
            yield f"Agno Agent 处理失败: {e!s}"
        finally:
            if self._in_thinking:
                yield "[/THINK]"
                self._in_thinking = False
            current_session_id.set(None)

    def is_available(self) -> bool:
        """检查 Agno Agent 是否可用"""
        return hasattr(self, "agent") and self.agent is not None
