"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Send, Square, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { sendChatMessageStream, type ToolCallEvent } from "@/lib/api";
import type { ChatMessage } from "@/apps/chat/types";
import { useLocaleStore } from "@/lib/store/locale";
import { queryKeys } from "@/lib/query/keys";
import { MessageBubble, MessageActions, StreamingIndicator, MarkdownContent } from "@/apps/chat/components/chat-ui/index";

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

export function QuickCommandPanel() {
  const locale = useLocaleStore((s) => s.locale);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
      setIsStreaming(true);

      const ac = new AbortController();
      abortRef.current = ac;
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
        setIsStreaming(false);
        abortRef.current = null;
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
    ? ["建个待办：明天买菜", "记一条笔记：今天试了新功能 #测试", "帮我打卡今天的跑步习惯"]
    : ["Add a todo: buy groceries tomorrow", "Note: tried the new feature #test", "Check in today's running habit"];

  return (
    <div className="flex h-full flex-col">
      {/* 标题 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <Sparkles className="w-4 h-4 text-primary/70" />
        <span className="text-sm font-semibold">{locale === "zh" ? "智能指令" : "Quick Command"}</span>
        <span className="text-[11px] text-muted-foreground/50 ml-1">
          {locale === "zh" ? "一句话操作 待办 / 笔记 / 习惯" : "One line for Todo / Note / Habit"}
        </span>
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center ring-1 ring-primary/10">
              <Sparkles className="w-6 h-6 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground/70 max-w-[260px] leading-relaxed">
              {locale === "zh"
                ? "输入一条指令，我会判断要操作待办、笔记还是习惯，并直接执行。"
                : "Type a command. I'll route it to todo, note, or habit and execute."}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-[320px]">
              {examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setInput(ex)}
                  className="px-2.5 py-1 text-xs rounded-full border border-border/40 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-primary/5 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} msg={m} isStreaming={isStreaming} />
          ))
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-border/30 px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-border/40 bg-background px-3 py-2 focus-within:border-primary/40 transition-colors">
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
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              title="停止"
              className="flex-shrink-0 rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!input.trim()}
              className="flex-shrink-0 rounded-lg p-2 text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
