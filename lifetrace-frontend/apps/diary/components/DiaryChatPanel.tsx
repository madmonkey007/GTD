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

// Parse [THINK]...[/THINK] markers from content
// Handles both complete and unclosed (during streaming) markers
function parseThinkingContent(content: string): Array<{ type: "text" | "think"; content: string }> {
	const parts: Array<{ type: "text" | "think"; content: string }> = [];
	const regex = /\[THINK\]([\s\S]*?)\[\/THINK\]/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(content)) !== null) {
		// Text before the thinking block
		if (match.index > lastIndex) {
			parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
		}
		// The thinking block
		parts.push({ type: "think", content: match[1] });
		lastIndex = regex.lastIndex;
	}

	// Handle remaining content — check for unclosed [THINK] (during streaming)
	const remaining = content.slice(lastIndex);
	if (remaining) {
		const unclosedMatch = remaining.match(/\[THINK\]([\s\S]*)/);
		if (unclosedMatch) {
			if (unclosedMatch.index! > 0) {
				parts.push({ type: "text", content: remaining.slice(0, unclosedMatch.index) });
			}
			parts.push({ type: "think", content: unclosedMatch[1] });
		} else {
			parts.push({ type: "text", content: remaining });
		}
	}

	return parts;
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

// ─── Thinking block ───

function ThinkingBlock({ content }: { content: string }) {
	return (
		<details className="group mt-1.5" open>
			<summary className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors select-none list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden">
				<svg
					className="w-3 h-3 transition-transform group-open:rotate-90"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
				<span>思考过程</span>
			</summary>
			<div className="mt-1.5 pl-4 text-xs leading-relaxed text-muted-foreground/70 italic border-l-2 border-muted-foreground/20 whitespace-pre-wrap">
				{content}
			</div>
		</details>
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
			className={`flex group ${isUser ? "justify-end" : "justify-start"}`}
		>
			<div className={isUser ? "max-w-[85%] min-w-0" : "w-full min-w-0"}>
				{/* 用户消息：先渲染附带的笔记卡片，再渲染文本 */}
				{isUser && msg.attachedNotes && msg.attachedNotes.length > 0 && (
					<div className="flex flex-col gap-1.5 mb-1.5 items-end">
						{msg.attachedNotes.map((n) => (
							<div key={n.id} className="w-full max-w-full rounded-lg border border-border/40 bg-background px-2.5 py-1.5">
								<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
									<MessageSquareText className="w-3 h-3" />
									<span className="truncate">{n.name}</span>
									{n.date && <span className="ml-auto shrink-0">{n.date.slice(5, 10)}</span>}
								</div>
								{n.preview && (
									<p className="mt-0.5 text-[11px] text-muted-foreground/60 line-clamp-2 leading-relaxed">{n.preview}</p>
								)}
							</div>
						))}
					</div>
				)}
				<div className={`px-3.5 text-sm leading-relaxed ${
					isUser
						? "inline-block rounded-lg py-1.5 text-foreground"
						: "rounded-2xl py-2.5 text-foreground border border-border/30 bg-muted/25"
				}`} style={isUser ? { backgroundColor: "#EFEFEE" } : undefined}>
					{isUser ? (
						msg.content ? (
							<p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
						) : null
					) : (
						<>
							{msg.content === "" && isStreaming ? (
								<StreamingIndicator />
							) : msg.content ? (
								<div className="text-[13px] [&_details+div]:mt-3 [&_details]:mb-3">
									{msg.content.includes("[THINK]") ? (
										parseThinkingContent(msg.content).map((part, i) =>
											part.type === "think" ? (
												<ThinkingBlock key={i} content={part.content} />
											) : part.content ? (
												<MarkdownContent key={i} text={part.content} />
											) : null,
										)
									) : (
										<MarkdownContent text={msg.content} />
									)}
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

// 笔记页思维教练 system prompt（用户不可见，仅注入后端）
const THINKING_COACH_SYSTEM_PROMPT = `你是一个思维教练，不是助手。
你的任务是帮用户发现他自己没有意识到的思维模式和逻辑盲点。
用户会给你一条当前笔记，以及系统提供的关联笔记。
---
【第一步：判断任务类型】
拿到笔记后，先问自己两个问题：
问题1：这条笔记内部，或者和关联笔记之间，有没有逻辑冲突？
- 用户引用了多个观点，但这些观点其实互相矛盾
- 用户的结论跳步了，中间缺少推导
- 用户把两件不同的事当成了同一件事
问题2：这些笔记是否共享一个底层假设，
但用户把它当成了自然规律，而不是一种选择？
- 多条笔记在讲不同的事，但底层逻辑是同一套
- 用户反复用同一个框架衡量不同的事情
- 这个框架有代价，但用户没有意识到
---
【第二步：执行任务】
如果问题1是yes：
做逻辑解剖
- 指出冲突或跳步在哪
- 不要帮用户和解，让冲突暴露出来
- 不要给结论，让用户自己面对这个张力
如果问题2是yes：
做模式映射
- 给底层假设命名
- 指出这个假设如何影响用户看待事情，或者看待自己
- 指出这个假设的代价，不要评判，只是暴露
如果两个都是yes：
先做逻辑解剖，再做模式映射
顺序不能反
---
【第三步：结尾提问】
最后提一个问题
- 必须是用户自己能回答的
- 需要认真想，不能用是或否回答
- 问题指向用户还没想清楚的那个地方
---
【语气规则】
- 不夸奖用户想得好
- 不给建议，不提供解决方案
- 不总结，不收束
- 直接说，不绕弯
- 可以温和，但不回避尖锐的地方
- 说用户的逻辑，不说用户这个人
  （先分析逻辑，再映射到人；顺序反了用户会感觉被评判）
---
【格式规则】
- 不要分点列清单
- 用自然段落
- 长度控制在300字以内
- 结尾问题单独成段

你会收到：
- 1条当前笔记
- 4条主题相关笔记
- 2条跨域笔记（主题不同但可能有底层关联）
处理顺序：
先读当前笔记，再读相关笔记，最后看跨域笔记
跨域笔记不一定有关联，如果连不上就忽略
如果连得上，优先用它做模式映射`;

// 格式化单条笔记为上下文文本
// 兼容后端 snake_case（user_notes）和前端 camelCase（userNotes）两种字段名
function formatJournalForContext(j: { name?: string | null; userNotes?: string | null; user_notes?: string | null; date?: string | null; tags?: { tagName: string }[] | string[] } | null | undefined, label: string): string {
	if (!j) return "";
	const name = j.name || "未命名";
	const notes = j.userNotes || j.user_notes || "无内容";
	const date = j.date || "";
	const tags = Array.isArray(j.tags) ? j.tags.map((t: any) => typeof t === "string" ? t : t?.tagName).filter(Boolean) : [];
	return `[${label}]\n标题: ${name}\n日期: ${date}\n标签: ${tags.join(", ") || "无"}\n内容: ${notes}`;
}

// 拉取洞察上下文（当前笔记 + 4相似 + 2跨域），失败返回 null
async function fetchInsightContext(journalId: number | null | undefined): Promise<{ text: string; current: Record<string, unknown> | null; similarCount: number; crossCount: number } | null> {
	if (!journalId) return null;
	try {
		const baseUrl = (typeof window !== "undefined" && (window as any).__BACKEND_URL__) || "http://localhost:8001";
		const resp = await fetch(`${baseUrl}/api/journals/${journalId}/insight-context`, { headers: { "Accept": "application/json" } });
		if (!resp.ok) return null;
		const data = await resp.json();
		const current = data.current;
		const similar: any[] = data.similar || [];
		const cross: any[] = data.cross_domain || [];
		if (!current) return null;
		const parts: string[] = [formatJournalForContext(current, "当前笔记")];
		if (similar.length) parts.push(similar.map((n, i) => formatJournalForContext(n, `主题相关笔记 ${i + 1}`)).join("\n---\n"));
		if (cross.length) parts.push(cross.map((n, i) => formatJournalForContext(n, `跨域笔记 ${i + 1}`)).join("\n---\n"));
		return { text: parts.join("\n\n"), current, similarCount: similar.length, crossCount: cross.length };
	} catch {
		return null;
	}
}

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
	currentJournalId?: number | null;
	showBackButton?: boolean;
	onClose?: () => void;
};

export function DiaryChatPanel({ noteContent, currentJournalId, showBackButton = false, onClose }: DiaryChatPanelProps) {
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
					systemPrompt: THINKING_COACH_SYSTEM_PROMPT,
				selectedTools: ["create_note","delete_note","search_notes","list_notes_by_tags","list_notes_by_date","get_insight","suggest_note_tags"],
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
		const uid = createId();
		const aid = createId();
		setMessages((prev) => [
			...prev,
			{ id: uid, role: "user", content: `🧠 ${tab.label}` },
			{ id: aid, role: "assistant", content: "" },
		]);
		const basePrompt = TAB_PROMPTS[tab.key]?.replace("{{notes}}", noteContent || "（暂无笔记内容）")
			?? "请分析以上笔记内容。";
		const noteCtx = buildNoteContext();
		doStream(noteCtx ? `${noteCtx}\n\n${basePrompt}` : basePrompt, aid);
	}, [noteContent, isStreaming, doStream]);

	const handleSendInput = useCallback(async () => {
		if (isStreaming) return;
		const linked = useNoteChatStore.getState().linkedNotes;
		const hasCard = linked.length > 0 || !!currentJournalId;
		if (!inputValue.trim() && !hasCard) return;
		setError(null);
		const text = inputValue.trim();
		setInputValue("");
		const uid = createId();
		const aid = createId();
		// "当前笔记"取最近添加的卡片；没有手动添加则用当前选中日期的笔记
		const latestNoteId = linked.length > 0 ? linked[linked.length - 1].id : currentJournalId;
		const insight = await fetchInsightContext(latestNoteId);
		let noteCtx = "";
		let attachedNotes: { id: number; name: string; preview: string; date: string }[] | undefined;
		if (insight) {
			noteCtx = insight.text;
		} else {
			noteCtx = buildNoteContext();
		}
		// attachedNotes 展示所有手动添加的卡片（按添加顺序）
		if (linked.length > 0) {
			attachedNotes = linked.map((n) => ({
				id: n.id,
				name: n.name || "未命名",
				preview: (n.userNotes || "").slice(0, 80),
				date: n.date || "",
			}));
		} else if (insight?.current) {
			const cur = insight.current as Record<string, unknown>;
			attachedNotes = [{
				id: Number(cur.id),
				name: String(cur.name || "未命名"),
				preview: String(cur.user_notes || cur.userNotes || "").slice(0, 80),
				date: String(cur.date || ""),
			}];
		}
		setMessages((prev) => [
			...prev,
			{ id: uid, role: "user", content: text, attachedNotes },
			{ id: aid, role: "assistant", content: "" },
		]);
		const prompt = noteCtx ? `${noteCtx}\n\n${text || "请分析以上笔记内容。"}` : text;
		doStream(prompt, aid);
		clearLinkedNotes();
	}, [inputValue, isStreaming, doStream, clearLinkedNotes, currentJournalId]);

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
							<button type="button" onClick={handleSendInput} disabled={isStreaming || (!inputValue.trim() && !currentJournalId && useNoteChatStore.getState().linkedNotes.length === 0)} title="发送"
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
