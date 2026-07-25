"use client";

import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Send, Square, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { sendChatMessageStream, type ToolCallEvent } from "@/lib/api";
import type { ChatMessage, ToolCallStep } from "@/apps/chat/types";
import { useLocaleStore } from "@/lib/store/locale";
import { queryKeys } from "@/lib/query/keys";

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

function parseThinkingContent(content: string): Array<{ type: "text" | "think"; content: string }> {
	const parts: Array<{ type: "text" | "think"; content: string }> = [];
	const regex = /\[THINK\]([\s\S]*?)\[\/THINK\]/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(content)) !== null) {
		if (match.index > lastIndex) {
			parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
		}
		parts.push({ type: "think", content: match[1] });
		lastIndex = regex.lastIndex;
	}
	const remaining = content.slice(lastIndex);
	if (remaining) {
		const unclosed = remaining.match(/\[THINK\]([\s\S]*)/);
		if (unclosed) {
			if (unclosed.index! > 0) parts.push({ type: "text", content: remaining.slice(0, unclosed.index) });
			parts.push({ type: "think", content: unclosed[1] });
		} else {
			parts.push({ type: "text", content: remaining });
		}
	}
	return parts;
}

function MarkdownContent({ text }: { text: string }) {
	return (
		<div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-foreground prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-muted/60 prose-code:text-foreground prose-code:text-[11px] prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/40 prose-pre:rounded-xl prose-strong:text-foreground">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
		</div>
	);
}

function ThinkingBlock({ content }: { content: string }) {
	return (
		<details className="group mt-1.5" open>
			<summary className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors select-none list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
				<svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
				<span>思考过程</span>
			</summary>
			<div className="mt-1.5 pl-4 text-xs leading-relaxed text-muted-foreground/70 italic border-l-2 border-muted-foreground/20 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
			</div>
		</details>
	);
}

function ToolCallStepChip({ step }: { step: ToolCallStep }) {
	const [expanded, setExpanded] = useState(false);
	return (
		<div className="my-1.5">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex items-center gap-2 w-full text-left px-2 py-1 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground/70"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
					<path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
					<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
				</svg>
				<span className="text-xs flex-1 truncate">
					{step.toolName}
					{step.status === "running" && (
						<span className="ml-1.5 inline-flex items-center gap-1">
							<span className="relative flex h-1.5 w-1.5">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-muted-foreground/70" />
								<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-muted-foreground/70" />
							</span>
						</span>
					)}
				</span>
			</button>
			{expanded && step.resultPreview && (
				<pre className="mt-0.5 ml-8 px-2 py-1.5 rounded-md text-[11px] leading-relaxed whitespace-pre-wrap break-all overflow-x-auto max-h-48 overflow-y-auto bg-muted/40 text-muted-foreground/70">
					{step.resultPreview}
				</pre>
			)}
		</div>
	);
}

function AssistantBody({ content, steps, finalReply }: { content: string; steps?: ToolCallStep[]; finalReply?: { source: string; text: string }; }) {
	const all = steps ?? [];
	const anchored = all.filter((s) => typeof s.insertAt === "number").slice().sort((a, b) => a.insertAt! - b.insertAt!);
	const unanchored = all.filter((s) => typeof s.insertAt !== "number");
	const pieces: ReactNode[] = [];
	let ki = 0;
	const pushText = (text: string) => {
		if (!text) return;
		if (text.includes("[THINK]")) {
			parseThinkingContent(text).forEach((part) => {
				if (part.type === "think") pieces.push(<ThinkingBlock key={ki++} content={part.content} />);
				else if (part.content) pieces.push(<MarkdownContent key={ki++} text={part.content} />);
			});
		} else {
			pieces.push(<MarkdownContent key={ki++} text={text} />);
		}
	};
	let cursor = 0;
	for (const s of anchored) {
		const at = Math.max(0, Math.min(s.insertAt!, content.length));
		pushText(content.slice(cursor, at));
		pieces.push(<ToolCallStepChip key={ki++} step={s} />);
		cursor = at;
	}
	pushText(content.slice(cursor));
	unanchored.forEach((s) => pieces.push(<ToolCallStepChip key={ki++} step={s} />));

	// 最终回复：仅在后端注入了 [FINAL] 时渲染（写操作回执 / 终态正文），
	// 不重复中间正文（content 中的文本已通过 pieces 展示）。
	const finalText = finalReply?.text;

	return (
		<>
			{pieces}
			{finalText && <MarkdownContent key={`final-${ki}`} text={finalText} />}
		</>
	);
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
							setMessages((prev) => prev.map((m) => (m.id === assistantId ? {
								...m,
								toolCallSteps: [...(m.toolCallSteps ?? []), {
									id: "tc-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6),
									toolName: event.tool_name!,
									toolArgs: event.tool_args,
									status: "running",
									startTime: Date.now(),
									insertAt,
								}],
							} : m)));
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
						<motion.div
							key={m.id}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25 }}
							className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
						>
							{m.role === "user" ? (
								<div className="max-w-[85%] inline-block rounded-lg px-3.5 py-1.5 text-[13px] whitespace-pre-wrap text-foreground" style={{ backgroundColor: "#EFEFEE" }}>
									{m.content}
								</div>
							) : (
								<div className="w-full min-w-0 rounded-2xl px-3.5 py-2.5 text-sm text-foreground border border-border/30 bg-muted/25">
									{m.content || m.toolCallSteps?.length ? (
										<AssistantBody content={m.content} steps={m.toolCallSteps} finalReply={m.finalReply} />
									) : (
										<span className="inline-flex items-center gap-2 text-muted-foreground/60">
											<span className="relative flex h-2 w-2">
												<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
												<span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
											</span>
											<span className="text-xs">{locale === "zh" ? "处理中" : "Working"}</span>
										</span>
									)}
								</div>
							)}
						</motion.div>
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
