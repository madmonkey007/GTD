"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Check, Copy, Send, Square, Sparkles, MessageSquareText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { sendChatMessageStream } from "@/lib/api";
import type { ChatMessage } from "@/apps/chat/types";
import { LinkedNotes } from "@/apps/chat/components/input/LinkedNotes";
import { useNoteChatStore } from "@/lib/store/note-chat-store";
import { useLocaleStore } from "@/lib/store/locale";

// ─── Tab definitions ───

type TabDef = { key: string; label: string };

const TAB_LABELS: Record<string, string> = {
	insight: "默认洞察",
	value: "价值澄清",
	inversion: "逆向思考",
	secondOrder: "二阶思考",
	cbt: "CBT疗法",
	mbti: "MBTI分析",
};

const ANALYSIS_TABS: TabDef[] = Object.entries(TAB_LABELS).map(([key, label]) => ({ key, label }));

const TAB_PROMPTS: Record<string, string> = {
	insight: `你是一位深度思维分析师，专门帮助用户从笔记中发现隐藏的认知模式。

## 你的任务
仔细阅读用户提供的所有笔记内容，从以下维度进行深度分析：

1. **核心主题识别**：找出笔记中反复出现的关键词、概念和主题
2. **思维模式提炼**：识别用户看待问题的惯常视角和思考框架
3. **思维盲点揭示**：发现用户可能忽略或回避的领域
4. **认知图谱勾勒**：将碎片化记录连接成完整的思考轨迹

## 输出原则
- 不替用户得出结论，而是提出深刻的问题激发用户自我反思
- 以第三方观察者的客观视角呈现分析
- 语言简洁，洞见犀利，避免泛泛而谈
- 结尾提出 2-3 个能引发深度思考的问题

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
	value: `你是一位价值观挖掘顾问，擅长从日常碎片化记录中提炼一个人真正在意的东西。

## 你的任务
阅读用户提供的笔记，完成以下分析：

1. **高频关注点**：找出用户反复记录、反复提及的人、事、物、概念
2. **情绪锚点**：识别哪些内容触发了用户强烈的情绪反应（无论正负）
3. **核心价值观提炼**：从以上线索中归纳出 3-5 条用户深层在意的原则
4. **行为导向建议**：基于这些价值观，指出用户在决策时可以遵循的长期方向

## 输出格式
- 用简短的标题命名每条价值观（如"深度胜于广度"、"关系重于效率"）
- 附上来自笔记的具体证据支撑每条提炼
- 最后提问：这些价值观是否真的是你想要坚守的？

## 注意
不要投用户所好，如果发现价值观之间存在冲突，要明确指出。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
	inversion: `你是查理·芒格的逆向思维实践者。你相信"如果我知道自己会死在哪里，我就永远不去那个地方"。

## 你的任务
阅读用户的笔记，运用逆向思维方法进行分析：

1. **识别核心假设**：找出用户笔记中隐含的、未被质疑的前提和假设
2. **假设反转**：将每个关键假设翻转，问"如果相反的情况是真的呢？"
3. **风险识别**：从反转视角发现用户可能忽视的风险、漏洞或盲区
4. **隐藏可能性**：找出被常规思维屏蔽掉的替代方案或机会

## 输出格式
对每个关键假设：
- 原始假设：用户默认相信的是...
- 反转假设：但如果...
- 潜在风险/可能性：这意味着...

## 语气
直接、犀利，不回避让用户不舒服的结论。好的逆向思考有时令人不悦，但极具价值。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
	secondOrder: `你是一位系统性思维教练，专注于帮助用户从表层现象穿透到底层规律。

## 核心理念
一阶思考问："这是什么？"
二阶思考问："这背后是什么？这会导致什么？这和什么相关？"

## 你的任务
阅读用户笔记，完成以下分析：

1. **表层问题识别**：找出用户笔记中显性记录的困惑、问题或现象
2. **深层规律提炼**：
   - 这些问题的共同根源是什么？
   - 哪些底层模式在反复制造这些表层问题？
3. **跨笔记关联**：将看似无关的笔记串联，发现隐藏的系统性联系
4. **认知突破点**：指出一旦理解某个底层规律，哪些问题会迎刃而解

## 输出格式
- 先列出表层现象
- 用"→"符号引导到深层规律
- 最终提炼出 1-2 个核心洞见，要有足够的概括力和冲击力

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
	cbt: `你是一位受过认知行为疗法（CBT）训练的思维观察者。
注意：你不是心理治疗师，你的作用是帮助用户觉察思维模式，而非提供临床治疗。

## CBT核心框架
情境 → 自动化思维 → 情绪/行为
改变认知 = 改变情绪和行为的入口

## 你的任务
阅读用户笔记，完成以下分析：

1. **思维陷阱识别**：找出以下常见认知扭曲的证据：
   - 全或无思维（非黑即白）
   - 灾难化（过度放大负面）
   - 心理过滤（忽视正面信息）
   - 情绪化推理（凭感觉下结论）
   - 应该化陈述（过度苛责自己）
   - 个人化（过度揽责）

2. **情绪-思维链梳理**：识别是哪种思维触发了哪种情绪

3. **认知重构建议**：针对每个思维陷阱，提供具体的替代性思考方式

4. **行动建议**：提出 1-2 个小的、可执行的行为实验来验证新认知

## 语气
温暖而不失客观，支持而不回避问题，像一个不评判的智慧朋友。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
	mbti: `你是一位人格类型分析师，精通 MBTI（迈尔斯-布里格斯类型指标）理论。

## 重要前提
MBTI 是一种认知框架工具，而非科学测量。你的分析基于文字表达习惯推断倾向，
结果供参考和自我探索，而非最终定论。

## 四个维度分析框架
- **E/I**（能量来源）：外倾 vs 内倾
- **S/N**（信息获取）：感觉 vs 直觉
- **T/F**（决策方式）：思考 vs 情感
- **J/P**（生活方式）：判断 vs 知觉

## 你的任务
阅读用户笔记，从以下角度进行分析：

1. **语言风格观察**：
   - 倾向具体细节还是抽象概念？（S vs N）
   - 倾向逻辑分析还是价值判断？（T vs F）
   - 倾向计划总结还是开放探索？（J vs P）
   - 倾向内省独处还是外部互动？（E vs I）

2. **倾向评估**：对每个维度给出倾向判断及置信度（强/中/弱）

3. **类型推断**：综合给出最可能的 MBTI 类型，并解释推断依据

4. **实用洞见**：基于推断类型，指出：
   - 用户可能的能量来源和消耗点
   - 决策时的典型模式
   - 潜在的盲区和成长方向

## 输出格式
先呈现证据，再给出推断，最后给出实用建议。
明确标注哪些是强证据，哪些是弱信号。

**重要：请使用简体中文回答。**

## 笔记内容
{{notes}}`,
};

// ─── Helpers ───

function createId() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ─── Empty state ───

function EmptyState({ onTabSelect }: { onTabSelect: (tab: TabDef) => void }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
			className="flex h-full flex-col items-center justify-center px-6"
		>
			<div className="flex flex-col items-center gap-5 text-center">
				<div className="relative">
					<div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center ring-1 ring-primary/10">
						<Sparkles className="w-7 h-7 text-primary/60" />
					</div>
					<div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center">
						<div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
					</div>
				</div>

				<div className="space-y-1.5">
					<h2 className="text-base font-semibold tracking-tight text-foreground">
						思维分析
					</h2>
					<p className="text-sm text-muted-foreground/70 leading-relaxed max-w-[240px]">
						选择一个分析维度开始探索，或直接输入你的问题
					</p>
				</div>

				<div className="flex flex-wrap justify-center gap-1.5 max-w-[260px]">
					{ANALYSIS_TABS.map((tab) => (
						<motion.button
							key={tab.key}
							type="button"
							onClick={() => onTabSelect(tab)}
							whileHover={{ scale: 1.03 }}
							whileTap={{ scale: 0.97 }}
							className="px-3 py-1.5 text-xs rounded-full border border-border/40 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground hover:bg-primary/5 transition-colors font-medium"
						>
							{tab.label}
						</motion.button>
					))}
				</div>
			</div>
		</motion.div>
	);
}

// ─── Markdown content ───

function MarkdownContent({ text }: { text: string }) {
	return (
		<div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-foreground prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:leading-relaxed prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-muted/60 prose-code:text-foreground prose-code:text-[11px] prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/40 prose-pre:rounded-xl prose-strong:text-foreground">
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
		</div>
	);
}

// ─── Message actions ───

function MessageActions({ content }: { content: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(content).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}).catch(() => {});
	}, [content]);

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: 0.3, duration: 0.2 }}
			className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
		>
			<button type="button" onClick={handleCopy} title="复制"
				className="rounded-md p-1 text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors">
				{copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
			</button>
		</motion.div>
	);
}

// ─── Streaming indicator ───

function StreamingIndicator() {
	return (
		<span className="inline-flex items-center gap-2 text-muted-foreground/60">
			<span className="relative flex h-2 w-2">
				<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
				<span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
			</span>
			<span className="text-xs">分析中</span>
		</span>
	);
}

// ─── Message bubble ───

function MessageBubble({ msg, isStreaming }: { msg: ChatMessage; isStreaming: boolean }) {
	const isUser = msg.role === "user";

	return (
		<motion.div
			initial={{ opacity: 0, y: 8, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className="flex gap-2.5 group"
		>
			<div className={`flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center mt-0.5 ring-1 ${
				isUser
					? "bg-primary/10 text-primary ring-primary/10"
					: "bg-muted/50 text-muted-foreground ring-border/30"
			}`}>
				{isUser ? (
					<MessageSquareText className="w-3.5 h-3.5" />
				) : (
					<Sparkles className="w-3.5 h-3.5" />
				)}
			</div>

			<div className="flex-1 min-w-0">
				<div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
					isUser
						? "bg-primary/8 text-foreground border border-primary/10"
						: "bg-muted/25 text-foreground border border-border/30"
				}`}>
					{isUser ? (
						<p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
					) : (
						<>
							{msg.content === "" && isStreaming ? (
								<StreamingIndicator />
							) : msg.content ? (
								<div className="text-[13px]">
									<MarkdownContent text={msg.content} />
								</div>
							) : null}
						</>
					)}
				</div>
				{!isUser && msg.content && <MessageActions content={msg.content} />}
			</div>
		</motion.div>
	);
}

// ─── Main component ───

// 构建关联笔记上下文（格式与全局 ChatPanel 的 useSendMessage 保持一致）
function buildNoteContext() {
	const notes = useNoteChatStore.getState().linkedNotes;
	return notes.length > 0
		? `[关联笔记]\n${notes.map((n) =>
			`笔记标题: ${n.name || "未命名"}\n笔记内容: ${n.userNotes || "无内容"}\n日期: ${n.date}\n标签: ${n.tags.join(", ") || "无"}`
		).join("\n---\n")}\n---`
		: "";
}

type DiaryChatPanelProps = {
	noteContent: string;
	showBackButton?: boolean;
	onClose?: () => void;
};

export function DiaryChatPanel({ noteContent, showBackButton = false, onClose }: DiaryChatPanelProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const clearLinkedNotes = useNoteChatStore((s) => s.clearLinkedNotes);
	const { locale } = useLocaleStore();

	useEffect(() => {
		if (listRef.current) {
			listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
		}
	}, [messages]);

	const doStream = useCallback(async (prompt: string, assistantId: string) => {
		setIsStreaming(true);
		setError(null);
		const ac = new AbortController();
		abortRef.current = ac;
		try {
			await sendChatMessageStream(
				{
					message: prompt,
					userInput: prompt,
					conversationId: conversationId ?? undefined,
					mode: "agno",
				},
				(chunk) => setMessages((prev) =>
					prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m),
				),
				(id) => id && setConversationId(id),
				ac.signal,
				locale,
			);
		} catch (err) {
			if (ac.signal.aborted) return;
			setMessages((prev) =>
				prev.map((m) => m.id === assistantId && m.content === ""
					? { ...m, content: "抱歉，分析过程出现错误，请重试。" } : m),
			);
			setError("请求失败，请检查后端服务是否正常运行");
		} finally {
			setIsStreaming(false);
			abortRef.current = null;
		}
	}, [conversationId, locale]);

	const handleTabClick = useCallback((tab: TabDef) => {
		if (isStreaming) return;
		const id = createId();
		setMessages((prev) => [...prev, { id, role: "assistant", content: "" }]);
		const basePrompt = TAB_PROMPTS[tab.key]?.replace("{{notes}}", noteContent || "（暂无笔记内容）")
			?? "请分析以上笔记内容。";
		const noteCtx = buildNoteContext();
		doStream(noteCtx ? `${noteCtx}\n\n${basePrompt}` : basePrompt, id);
	}, [noteContent, isStreaming, doStream]);

	const handleSendInput = useCallback(() => {
		if (!inputValue.trim() || isStreaming) return;
		setError(null);
		const text = inputValue.trim();
		setInputValue("");
		const uid = createId();
		const aid = createId();
		setMessages((prev) => [
			...prev,
			{ id: uid, role: "user", content: text },
			{ id: aid, role: "assistant", content: "" },
		]);
		const noteCtx = buildNoteContext();
		doStream(noteCtx ? `${noteCtx}\n\n${text}` : text, aid);
		clearLinkedNotes();
	}, [inputValue, isStreaming, doStream, clearLinkedNotes]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendInput();
		}
	}, [handleSendInput]);

	const handleStop = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setIsStreaming(false);
	}, []);

	const showWelcome = messages.length === 0 && !isStreaming;

	return (
		<div className="flex h-full flex-col bg-background">
			{/* Header */}
			<div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/30">
				<div className="flex items-center gap-2">
					{showBackButton && (
						<button
							type="button"
							onClick={onClose}
							className="p-1 text-muted-foreground hover:text-foreground transition-colors mr-1"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M19 12H5m7-7-7 7 7 7"/>
							</svg>
						</button>
					)}
					<div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
						<Sparkles className="w-3.5 h-3.5 text-primary/60" />
					</div>
					<span className="text-sm font-semibold tracking-tight text-foreground/80">
						思维分析
					</span>
					{isStreaming && (
						<span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
							<span className="relative flex h-1.5 w-1.5">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
								<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/60" />
							</span>
							生成中
						</span>
					)}
				</div>
			</div>

			{/* Messages area */}
			<div className="flex-1 min-h-0 overflow-hidden">
				{showWelcome ? (
					<EmptyState onTabSelect={handleTabClick} />
				) : (
					<div ref={listRef} className="h-full overflow-y-auto space-y-3 px-3 py-3 scrollbar-thin">
						<AnimatePresence mode="popLayout">
							{messages.map((msg) => (
								<MessageBubble key={msg.id} msg={msg} isStreaming={isStreaming} />
							))}
						</AnimatePresence>
					</div>
				)}
			</div>

			{/* Error banner */}
			<AnimatePresence>
				{error && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						className="overflow-hidden"
					>
						<div className="px-4 py-2">
							<div className="flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2">
								<div className="w-1.5 h-1.5 rounded-full bg-destructive/50 flex-shrink-0" />
								<p className="text-[11px] text-destructive/70 leading-relaxed">{error}</p>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Bottom: input */}
			<div className="flex-shrink-0 border-t border-border/30 bg-muted/10">
				<div className="px-3 pb-3 pt-3">
					<LinkedNotes locale="zh" />
					<div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background px-3.5 py-2.5 transition-all duration-200 focus-within:border-primary/30 focus-within:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]">
						<input
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="输入自定义问题..."
							disabled={isStreaming}
							className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none disabled:opacity-40"
						/>
						{isStreaming ? (
							<button type="button" onClick={handleStop} title="停止"
								className="flex items-center justify-center rounded-lg bg-muted/50 p-1.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
								<Square className="w-3.5 h-3.5 fill-current" />
							</button>
						) : (
							<button type="button" onClick={handleSendInput} disabled={!inputValue.trim()} title="发送"
								className="flex items-center justify-center rounded-lg bg-primary/10 p-1.5 text-primary hover:bg-primary/20 transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
								<Send className="w-3.5 h-3.5" />
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
