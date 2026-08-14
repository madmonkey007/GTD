"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, BookOpen, Heart, History, ListTodo, Loader2, Plus, Sparkles, Square, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import { sendChatMessageStream, type ToolCallEvent } from "@/lib/api";
import type { ChatMessage, ToolCallStep } from "@/apps/chat/types";
import { useLocaleStore } from "@/lib/store/locale";
import { useUiStore } from "@/lib/store/ui-store";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useTodoStore } from "@/lib/store/todo-store";
import { useFocusTarget } from "@/lib/store/focus-target-store";
import { queryKeys } from "@/lib/query/keys";
import { useChatSessions, useChatHistory } from "@/lib/query/chat";
import { MessageBubble } from "@/apps/chat/components/chat-ui/index";
import { VoiceInputButton } from "@/components/ui/voice-input-button";

// 三域工具全集：待办 + 笔记 + 习惯。后端 _build_instructions 检测到三类齐全
// 会切换到 quick_command_instructions（路由指令），由 LLM 按意图自选工具。
const QUICK_TOOLS = [
  // todo
  "create_todo", "complete_todo", "update_todo", "list_todos", "search_todos", "delete_todo",
  // note
  "create_note", "update_note", "delete_note", "search_notes", "get_note",
  "list_note_tags", "list_notes_by_tags", "list_notes_by_date", "get_insight", "suggest_note_tags",
  // habit
  "create_habit", "update_habit", "delete_habit", "list_habits", "search_habits",
  "toggle_habit_record", "list_habit_records",
];

const SYSTEM_PROMPT =
  "你是 LifeTrace 智能指令助手。用户用一句话下达指令，判断属于待办/笔记/习惯哪一类，直接调用对应 CRUD 工具执行，不要空谈。删除/更新/打卡前若目标不明，先 list/search 找到 id 再操作。完成后简洁汇报（含 id）。";

// 会触发列表刷新的写操作工具
const WRITE_TOOLS = new Set([
  "create_todo", "update_todo", "delete_todo", "complete_todo",
  "create_note", "update_note", "delete_note",
  "create_habit", "update_habit", "delete_habit", "toggle_habit_record",
]);

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// spring 物理：进入（stiffness 偏软、damping 偏大）避免弹跳；stagger 让标题→按钮逐个浮现
const CONTAINER_SPRING: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const ITEM_SPRING: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 },
  },
};

// 创建类工具 → 实体类型映射
const CREATE_TOOLS: Record<string, "todo" | "note" | "habit"> = {
  create_todo: "todo",
  create_note: "note",
  create_habit: "habit",
};

type ToolEvent = {
  type?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  result_preview?: string;
  error?: boolean;
};

/** 从历史记录的 extraData 重建工具调用步骤 */
function parseToolEvents(extraData?: string): ToolCallStep[] | undefined {
  if (!extraData) return undefined;
  try {
    const parsed = JSON.parse(extraData) as { tool_events?: ToolEvent[] };
    const events = parsed.tool_events;
    if (!Array.isArray(events) || events.length === 0) return undefined;
    const steps: ToolCallStep[] = [];
    for (const event of events) {
      if (event.type === "tool_call_start" && event.tool_name) {
        steps.push({
          id: `${event.tool_name}-${steps.length}`,
          toolName: event.tool_name,
          toolArgs: event.tool_args,
          status: "running",
          startTime: Date.now(),
        });
      } else if (event.type === "tool_call_end" && event.tool_name) {
        const idx = [...steps]
          .map((s, i) => ({ s, i }))
          .reverse()
          .find((it) => it.s.toolName === event.tool_name && it.s.status === "running")?.i;
        if (idx !== undefined) {
          steps[idx] = {
            ...steps[idx],
            status: event.error ? "error" : "completed",
            resultPreview: event.result_preview,
            endTime: Date.now(),
          };
        }
      }
    }
    return steps.length > 0 ? steps : undefined;
  } catch {
    return undefined;
  }
}

type Artifact = { kind: "todo" | "note" | "habit"; id: number | null; args: Record<string, unknown>; preview: string };

/** 从 assistant 消息中提取已完成的创建类工具产物 */
function extractArtifacts(m: ChatMessage): Artifact[] {
  if (!m.toolCallSteps) return [];
  const out: Artifact[] = [];
  for (const s of m.toolCallSteps) {
    const kind = CREATE_TOOLS[s.toolName];
    if (!kind || s.status !== "completed") continue;
    const idMatch = /#(\d+)/.exec(s.resultPreview ?? "");
    out.push({ kind, id: idMatch ? Number(idMatch[1]) : null, args: s.toolArgs ?? {}, preview: s.resultPreview ?? "" });
  }
  return out;
}

function nameFromArtifact(a: Artifact, zh: boolean): string {
  const fromArgs = typeof a.args.name === "string" && a.args.name.trim() ? a.args.name.trim() : "";
  if (fromArgs) return fromArgs;
  const afterColon = a.preview.split(":").slice(1).join(":").trim();
  if (afterColon) return afterColon;
  return zh ? "未命名" : "Untitled";
}

/** 创建实体卡片 */
function CreatedEntityCard({ artifact, locale }: { artifact: Artifact; locale: string }) {
  const zh = locale === "zh";
  const { kind, args, id } = artifact;
  const name = nameFromArtifact(artifact, zh);
  const typeLabel = kind === "todo" ? (zh ? "待办" : "Todo") : kind === "note" ? (zh ? "笔记" : "Note") : (zh ? "习惯" : "Habit");
  const tagsRaw = typeof args.tags === "string" ? args.tags : "";
  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
  const description = typeof args.description === "string" ? args.description.trim() : "";
  const noteContent = typeof args.user_notes === "string" ? args.user_notes.trim() : "";
  const frequency = typeof args.frequency === "string" ? args.frequency : "";
  const habitIcon = typeof args.icon === "string" && args.icon ? args.icon : null;

  const setActiveView = useUiStore((s) => s.setActiveView);
  const setSelectedTodoId = useTodoStore((s) => s.setSelectedTodoId);
  const setFocusTarget = useFocusTarget((s) => s.setTarget);

  const handleView = () => {
    if (kind === "todo") {
      if (id != null) setSelectedTodoId(id);
      setActiveView("list");
    } else if (kind === "note") {
      if (id != null) setFocusTarget({ feature: "note", id: String(id) });
      setActiveView("diary");
    } else {
      if (id != null) setFocusTarget({ feature: "habit", id: String(id) });
      setActiveView("habits");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-background px-3 py-2.5 shadow-sm"
    >
      <div className="flex items-start gap-2.5">
        <div className={
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm " +
          (kind === "todo" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            : kind === "note" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")
        }>
          {kind === "habit" && habitIcon ? <span>{habitIcon}</span>
            : kind === "todo" ? <ListTodo className="h-4 w-4" />
              : kind === "note" ? <BookOpen className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{typeLabel}</span>
            {id != null && <span className="text-[10px] text-muted-foreground/50">#{id}</span>}
            <span className="text-[10px] text-emerald-600/80">{zh ? "已创建" : "created"}</span>
          </div>
          <p className="text-sm font-medium text-foreground leading-snug break-words">{name}</p>
          {kind === "todo" && description && (
            <p className="mt-0.5 text-xs text-muted-foreground/80 line-clamp-2">{description}</p>
          )}
          {kind === "note" && noteContent && (
            <p className="mt-0.5 text-xs text-muted-foreground/80 line-clamp-3 whitespace-pre-wrap">{noteContent}</p>
          )}
          {kind === "habit" && frequency && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">{frequency}</p>
          )}
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">#{t}</span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleView}
          className="flex-shrink-0 self-center rounded-md border border-gray-300 bg-background px-2.5 py-1 text-xs font-medium text-black transition-colors hover:bg-gray-100"
        >
          {zh ? "查看" : "View"}
        </button>
      </div>
    </motion.div>
  );
}

export function QuickCommandPanel() {
  const locale = useLocaleStore((s) => s.locale);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 历史记录
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadTarget, setLoadTarget] = useState<string | null>(null);
  const { data: sessionsData, isLoading: sessionsLoading } = useChatSessions({
    chatType: "quickCommand",
    enabled: historyOpen,
  });
  const sessions = sessionsData ?? [];
  const { data: historyItems } = useChatHistory(loadTarget, { enabled: !!loadTarget });

  // 加载选中的历史会话
  useEffect(() => {
    if (!loadTarget || !historyItems) return;
    const rebuilt: ChatMessage[] = historyItems.map((it, i) => {
      // 由相邻消息的 createdAt 差值重建该 assistant 消息的处理耗时
      let durationMs: number | undefined;
      if (it.role === "assistant" && i > 0) {
        const prev = historyItems[i - 1];
        const curTs = it.createdAt ? Date.parse(it.createdAt) : NaN;
        const prevTs = prev.createdAt ? Date.parse(prev.createdAt) : NaN;
        if (!isNaN(curTs) && !isNaN(prevTs)) {
          durationMs = Math.max(0, curTs - prevTs);
        }
      }
      return {
        id: `hist-${loadTarget}-${i}`,
        role: it.role,
        content: it.content,
        toolCallSteps: it.role === "assistant" ? parseToolEvents(it.extraData) : undefined,
        finalReply: it.role === "assistant" ? { source: "stored", text: it.content } : undefined,
        durationMs,
      };
    });
    setMessages(rebuilt);
    setConversationId(loadTarget);
    setLoadTarget(null);
    setHistoryOpen(false);
  }, [loadTarget, historyItems]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setHistoryOpen(false);
  }, []);

  // 自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const invalidateByTool = useCallback(
    (toolName: string) => {
      if (toolName.includes("todo")) {
        queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
      } else if (toolName.includes("note")) {
        queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
      } else if (toolName.includes("habit")) {
        queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      }
    },
    [queryClient],
  );

  const doStream = useCallback(
    async (prompt: string) => {
      const userMsg: ChatMessage = { id: createId(), role: "user", content: prompt };
      const assistantId = createId();
      const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", toolCallSteps: [] };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreamingId(assistantId);
      setIsStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;
      const startedAt = Date.now();
      let assistantContent = "";
      try {
        await sendChatMessageStream(
          {
            message: prompt,
            userInput: prompt,
            conversationId: conversationId ?? undefined,
            mode: "agno",
            chatType: "quickCommand",
            systemPrompt: SYSTEM_PROMPT,
            selectedTools: QUICK_TOOLS,
          },
          (chunk) => {
            assistantContent += chunk;
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)));
          },
          (id) => id && setConversationId(id),
          ac.signal,
          locale,
          (event: ToolCallEvent) => {
            if (event.type === "tool_call_start" && event.tool_name) {
              const insertAt = assistantContent.length;
              setMessages((prev) => prev.map((m) => m.id === assistantId ? {
                ...m,
                toolCallSteps: [...(m.toolCallSteps ?? []), {
                  id: "tc-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6),
                  toolName: event.tool_name!,
                  toolArgs: event.tool_args,
                  status: "running",
                  startTime: Date.now(),
                  insertAt,
                }],
              } : m));
            } else if (event.type === "tool_call_end" && event.tool_name) {
              setMessages((prev) => prev.map((m) => {
                if (m.id !== assistantId || !m.toolCallSteps) return m;
                const steps = [...m.toolCallSteps];
                for (let i = steps.length - 1; i >= 0; i--) {
                  if (steps[i].toolName === event.tool_name && steps[i].status === "running") {
                    steps[i] = { ...steps[i], status: "completed", resultPreview: event.result_preview, endTime: Date.now() };
                    break;
                  }
                }
                return { ...m, toolCallSteps: steps };
              }));
              if (WRITE_TOOLS.has(event.tool_name)) invalidateByTool(event.tool_name);
            }
          },
          (payload) => {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, finalReply: payload } : m));
          },
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + `\n\n⚠️ ${(err as Error).message || "请求失败"}` } : m)));
        }
      } finally {
        const durationMs = Date.now() - startedAt;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, durationMs } : m)));
        setIsStreaming(false);
        setStreamingId(null);
        abortRef.current = null;
        queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory.sessions("quickCommand") });
      }
    },
    [conversationId, locale, invalidateByTool],
  );

  const onSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    void doStream(text);
  }, [input, isStreaming, doStream]);

  const onStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const examples = locale === "zh"
    ? [
        { label: "创建待办", prompt: "创建待办：明天买菜", icon: ListTodo },
        { label: "打卡新习惯", prompt: "打卡今天的跑步", icon: Heart },
        { label: "记录新笔记", prompt: "记笔记：思行合一", icon: BookOpen },
      ]
    : [
        { label: "Add a todo", prompt: "Add todo: buy groceries", icon: ListTodo },
        { label: "Check in a habit", prompt: "Check today's run", icon: Heart },
        { label: "Write a note", prompt: "Note: thoughts & action", icon: BookOpen },
      ];

  return (
    <div className="relative flex h-full flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          title={locale === "zh" ? "历史记录" : "History"}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${historyOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`}
        >
          <History className="h-4 w-4" />
        </button>
        <Sparkles className="w-4 h-4 text-primary/70" />
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={CONTAINER_SPRING}
            className="mx-auto flex h-full w-full flex-col justify-center px-6"
            style={{ maxWidth: 640 }}
          >
            {/* 大字体提示：保留一句今天要做点什么 */}
            <motion.h2
              variants={ITEM_SPRING}
              className="text-3xl font-semibold tracking-tighter text-foreground leading-[1.08] md:text-4xl"
            >
              {locale === "zh" ? "今天你要做什么" : "What's on your mind today?"}
            </motion.h2>
            <motion.p
              variants={ITEM_SPRING}
              className="mt-2.5 text-sm leading-relaxed text-muted-foreground/80"
            >
              {locale === "zh"
                ? "一句话创建待办、记录笔记、打卡习惯，剩下的交给我。"
                : "One line to add a todo, jot a note, or check in a habit."}
            </motion.p>

            <motion.div variants={ITEM_SPRING} className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {examples.map((ex) => {
                const Icon = ex.icon;
                return (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setInput(`${ex.label}${locale === "zh" ? "：" : ":"}`)}
                    className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.04] hover:shadow-sm active:scale-[0.98]"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="block truncate text-sm font-medium text-foreground">{ex.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground/60">
                        {ex.prompt}
                      </span>
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        ) : (
          <div className="mx-auto space-y-4" style={{ width: isMobile ? "100%" : "70%" }}>
            {messages.map((m) => {
              const artifacts = m.role === "assistant" ? extractArtifacts(m) : [];
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isStreaming={isStreaming && m.id === streamingId}
                  footer={artifacts.map((a, i) => (
                    <CreatedEntityCard key={`${m.id}-art-${i}`} artifact={a} locale={locale} />
                  ))}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-border/30 px-4 py-3">
        <div className="mx-auto flex items-center gap-2 rounded-xl border border-border/40 bg-background px-3 py-2 focus-within:border-primary/40 transition-colors" style={{ width: isMobile ? "100%" : "70%" }}>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={locale === "zh" ? "输入指令…（Enter 发送，Shift+Enter 换行）" : "Type a command… (Enter to send)"}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/40 max-h-40"
          />
          <VoiceInputButton
            ownerId="quick-command"
            onTranscript={(text) => {
              setInput((prev) => (prev ? prev + " " + text : text));
              // 输入高度自适应
              const ta = taRef.current;
              if (ta) {
                ta.style.height = "auto";
                ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
              }
            }}
            className="flex-shrink-0 rounded-lg p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              title="停止"
              className="flex-shrink-0 rounded-lg p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!input.trim()}
              title="发送"
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-background hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {/* 历史记录抽屉（左侧滑出） */}
      {historyOpen && (
        <>
          <div
            className="absolute inset-0 z-30 bg-black/30"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-30 flex w-[85vw] max-w-64 flex-col border-r border-border bg-background shadow-lg">
            <div className="flex items-center justify-between px-3 py-3 border-b border-border/30">
              <span className="text-sm font-semibold">{locale === "zh" ? "历史记录" : "History"}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNewChat}
                  title={locale === "zh" ? "新对话" : "New chat"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  title={locale === "zh" ? "关闭" : "Close"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  {locale === "zh" ? "暂无历史记录" : "No history yet"}
                </p>
              ) : (
                sessions.map((s, i) => (
                  <button
                    key={s.sessionId ? `${s.sessionId}-${i}` : `s-${i}`}
                    type="button"
                    onClick={() => setLoadTarget(s.sessionId)}
                    className={`w-full rounded-lg border border-border/60 px-2.5 py-2.5 text-left transition-colors hover:bg-foreground/5 ${s.sessionId === conversationId ? "ring-1 ring-ring" : ""}`}
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {s.title || (locale === "zh" ? "新对话" : "New chat")}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground/70">
                      <span className="truncate">{s.lastActive ?? ""}</span>
                      {typeof s.messageCount === "number" && (
                        <span className="ml-1 flex-shrink-0">{s.messageCount}{locale === "zh" ? "条" : "msg"}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
