"use client";

import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
	ArrowDownLeft,
	ArrowUpRight,
	CheckSquare,
	ChevronDown,
	ChevronUp,
	GitFork,
	Link2,
	MessageCircle,
	MessageSquarePlus,
	MoreHorizontal,
	Pencil,
	Pin,
	PinOff,
	Trash2,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { NoteMarkdown } from "./NoteMarkdown";
import type { JournalView } from "@/lib/query";

/** 竖版卡片正文最大展示行数（参考网页正文短而整，过长再展开） */
const MAX_LINES = 8;

/**
 * 剔除与卡片底部标签重复的 #tag：正文里 `#标签`（词边界匹配，可带句末标点）
 * 在 TimeMachineNoteCard 渲染时隐藏，避免与底部标签行重复展示。
 * 共享的 NoteMarkdown 保持不动（普通笔记列表仍需内联 #tag chip）。
 */
function dedupeTagLines(content: string, tagNames: string[]): string {
	if (tagNames.length === 0) return content;
	// 词边界 + 可选的句末标点（，。；！？）随标签一起移除
	const re = new RegExp(`#(?:${tagNames.map(escapeRe).join("|")})(?=\\s|[，。；！？,.;!?]|$)`, "g");
	return content.replace(re, "");
}
function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface TimeMachineNoteCardProps {
	note: JournalView;
	notesList: JournalView[];
	relatedNotesData?: JournalView[];
	pinned: boolean;
	/** 卡片视觉变体（0-7，对应引用设计的 8 种样式） */
	variant: number;
	onStartEdit: () => void;
	onDelete: () => void;
	onTogglePin: () => void;
	onAnnotate: () => void;
	onOpenLink: () => void;
	onAddToChat: () => void;
	onSimilar: () => void;
	onOpenReference: (note: JournalView) => void;
	formatTime: (dateStr: string) => string;
	/** 国际化文案（从 DiaryEditor 传入，保持与全站一致） */
	t: (key: string) => string;
}

/**
 * 8 种卡片样式配置表。
 *
 * 来源：参考 HTML 的 10 种卡片，取前 8。融入项目 token（oklch var、border、muted），
 * 不引入被禁的纯黑/霓虹。字体体系对齐参考：卡片容器用 font-body（中文黑体），
 * 时间行用 font-display 衬线（对齐 .card-title），magazine/quote 正文用 font-display（对齐参考衬线正文）。
 *
 * skill 约束：单强调色、禁纯黑、禁霓虹、禁 emoji、触觉 active:scale、数字用 mono（时间行除外）。
 */
type VariantConfig = {
	name: string;
	wrap: string; // 容器 className（含参考 padding：40px/24px，magazine/quote 为 64px/40px）
	timeRow: string; // 时间戳行（对齐参考 .card-title 的 margin-bottom；border 变体含下划线装饰）
	body: string; // 正文 className（字号/行高/颜色/max-width/下间距，对齐参考 .card-body）
	tag: string; // 单个标签 className（对齐参考 .tag：0.75rem / 50px 圆角 / 3px 10px）
	timeBig: string; // 时间大字（对齐参考 .card-title 字号与颜色）
	timeClass: string; // 日期小字（对齐参考 .card-time：0.75rem / mono / 0.04em）
	refWrap: string; // 引用网络容器（对齐参考 .card-quote 视觉与下间距，去掉斜体）
	onDark?: boolean; // 是否深色底（影响操作图标 / 引用网络文字色）
	accent: string; // 卡片强调色（浅色卡绿 #2d5f5d，深色卡橙 #c8743a，标签/竖线/hover）
	decoration?: "tape" | "dot" | "topbar" | "leftbar"; // 装饰元素
};

const VARIANTS: VariantConfig[] = [
	// 0 · 文艺简约白卡：白底 + 左竖线引用 + 主色标签（参考 style-minimal）
	{
		name: "minimal",
		wrap: "bg-card border border-border/40 px-6 py-10",
		timeRow: "mb-4",
		body: "text-[0.9375rem] leading-[1.9] text-foreground/80 max-w-[42ch] mb-6",
		refWrap: "border-l-[3px] border-[var(--color-card-primary)] pl-4 mb-6 text-muted-foreground",
		tag: "bg-[var(--color-card-primary)]/10 text-[var(--color-card-primary)]",
		timeBig: "text-[1.125rem] text-foreground",
		timeClass: "text-muted-foreground",
		accent: "var(--color-card-primary)",
	},
	// 1 · 杂志感大引文：深色底 + 顶部主色条 + 大字引文（参考 style-magazine）
	{
		name: "magazine",
		wrap: "bg-[#1a1816] text-[#f7f5f1] px-10 py-16",
		timeRow: "mb-6",
		body: "font-display text-[#f7f5f1] font-medium leading-[1.7] max-w-[20ch] text-[1.25rem] mb-10",
		refWrap: "border-t border-white/10 pt-4 mb-6 text-[#f7f5f1]/65",
		tag: "border border-white/10 text-[#f7f5f1]/60 bg-transparent",
		timeBig: "text-base uppercase tracking-[0.08em] text-[#c8743a]",
		timeClass: "text-[#f7f5f1]/60",
		accent: "var(--color-card-accent)",
		onDark: true,
		decoration: "topbar",
	},
	// 2 · 暗色沉浸：暖炭底 + 橙 accent 竖线引用（参考 style-dark：#1c1a17 底 / #ece8e1 字 / #c8743a 橙）
	{
		name: "dark",
		wrap: "bg-[#1c1a17] text-[#ece8e1] border border-white/[0.08] px-6 py-10",
		timeRow: "mb-4",
		body: "text-[0.9375rem] leading-[1.9] text-[#ece8e1]/85 max-w-[42ch] mb-6",
		refWrap: "bg-white/[0.04] border-l-2 border-[#c8743a] pl-4 pr-4 py-4 rounded-r-sm mb-6 text-[#ece8e1]/70",
		tag: "bg-[#c8743a]/15 text-[#c8743a]",
		timeBig: "text-[1.125rem] text-[#ece8e1]",
		timeClass: "text-[#ece8e1]/50",
		accent: "var(--color-card-accent)",
		onDark: true,
	},
	// 3 · 手写便签：暖黄底 + 胶带 + 轻微倾斜（参考 style-sticky）
	{
		name: "sticky",
		wrap: "bg-[#f5edd6] text-[#5a4a1a] border border-black/[0.04] px-6 py-10 rotate-[-0.6deg]",
		timeRow: "mb-2",
		body: "text-[#5a4a1a] leading-[1.9] max-w-[40ch] text-[0.9rem] mb-4",
		refWrap: "border-t border-dashed border-[#5a4a1a]/25 pt-2 mb-4 text-[#5a4a1a]/75",
		tag: "bg-[#5a4a1a]/10 text-[#5a4a1a]",
		timeBig: "text-base text-[#5a4a1a]",
		timeClass: "text-[#5a4a1a]/60",
		accent: "var(--color-card-ink)",
		decoration: "tape",
	},
	// 4 · 极简边框：透明底 + 直角 + 下划线时间（参考 style-border，下划线在 .card-title 即时间行）
	{
		name: "border",
		wrap: "bg-transparent border border-[#1a1816]/12 rounded-none px-6 py-10 dark:border-white/10",
		timeRow: "mb-4 border-b border-[#1a1816]/12 pb-2 dark:border-white/10",
		body: "text-[0.9375rem] leading-[1.9] text-[#1a1816]/78 max-w-[42ch] mb-6 dark:text-foreground/80",
		refWrap: "pl-4 mb-6 text-[#1a1816]/45 dark:text-muted-foreground",
		tag: "bg-transparent border border-[#1a1816]/12 text-[#1a1816]/45 dark:border-white/15 dark:text-muted-foreground",
		timeBig: "text-[1.0625rem] text-[#1a1816] dark:text-foreground",
		timeClass: "text-[#1a1816]/45 dark:text-muted-foreground",
		accent: "var(--color-card-primary)",
	},
	// 5 · 渐变背景：暖米渐变 + 白色引用块（参考 style-gradient）
	{
		name: "gradient",
		wrap: "bg-gradient-to-br from-[#faf6ef] via-[#f0e8da] to-[#e8dfd0] dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 border border-border/40 px-6 py-10",
		timeRow: "mb-4",
		body: "text-[0.9375rem] leading-[1.9] text-[#1a1816]/80 max-w-[42ch] mb-6 dark:text-foreground/80",
		refWrap: "bg-white rounded-md p-3 mb-6 text-[#1a1816]/45 dark:bg-zinc-800 dark:text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
		tag: "bg-white text-[#2d5f5d] dark:bg-zinc-800 dark:text-foreground",
		timeBig: "text-[1.125rem] text-[#1a1816] dark:text-foreground",
		timeClass: "text-[#1a1816]/45 dark:text-muted-foreground/70",
		accent: "var(--color-card-primary)",
	},
	// 6 · 居中语录：主色深底 + 居中大字（参考 style-quote，正文 1.375rem / 1.65）
	{
		name: "quote",
		wrap: "bg-gradient-to-b from-[#2d5f5d] to-[#1a403e] text-[#ece8e1] text-center px-10 py-16",
		timeRow: "mb-10 justify-center",
		body: "font-display text-[#ece8e1] font-medium leading-[1.65] max-w-[24ch] mx-auto text-[1.375rem] mb-10",
		refWrap: "border-t border-white/10 pt-4 mb-6 text-[#ece8e1]/55",
		tag: "bg-white/10 text-[#ece8e1]",
		timeBig: "text-sm uppercase tracking-[0.1em] text-[#ece8e1]/60",
		timeClass: "text-[#ece8e1]/50",
		accent: "var(--color-card-accent)",
		onDark: true,
		decoration: "topbar",
	},
	// 7 · 时间轴：左主色粗竖线 + 圆点 + 主色日期（参考 style-timeline）
	{
		name: "timeline",
		wrap: "bg-card border border-border/40 rounded-r-[12px] rounded-l-none border-l-[3px] border-l-[var(--color-card-accent)] px-6 py-10",
		timeRow: "mb-2",
		body: "text-[0.9375rem] leading-[1.9] text-[#1a1816]/82 max-w-[42ch] mb-4 dark:text-foreground/80",
		refWrap: "border-l border-[#1a1816]/12 pl-4 mb-4 text-[#1a1816]/45 dark:border-white/15 dark:text-muted-foreground",
		tag: "bg-[var(--color-card-accent)]/8 text-[var(--color-card-accent)]",
		timeBig: "text-base text-foreground",
		timeClass: "text-[var(--color-card-accent)] font-medium",
		accent: "var(--color-card-accent)",
		decoration: "dot",
	},
];

export function TimeMachineNoteCard({
	note,
	notesList,
	relatedNotesData,
	pinned,
	variant,
	onStartEdit,
	onDelete,
	onTogglePin,
	onAnnotate,
	onOpenLink,
	onAddToChat,
	onSimilar,
	onOpenReference,
	formatTime,
	t,
}: TimeMachineNoteCardProps) {
	const [expanded, setExpanded] = useState(false);
	const [refsExpanded, setRefsExpanded] = useState(false);

	const cfg = VARIANTS[variant % VARIANTS.length];
	const onDark = !!cfg.onDark;

	const contentLines = note.userNotes?.split("\n") ?? [];
	const isLong = contentLines.length > MAX_LINES;
	const displayContent = expanded ? contentLines : contentLines.slice(0, MAX_LINES);
	// 底部标签行会展示 note.tags，正文里重复的 #tag 一并剔除（含句末标点）
	const bodyContent = displayContent
		.map((line) => dedupeTagLines(line, note.tags.map((tg) => tg.tagName)))
		.join("\n");

	const refIds = note.relatedNoteIds ?? [];
	const outgoingNotes = refIds
		.map((rid: number) => notesList.find((n) => n.id === rid) ?? relatedNotesData?.find((n) => n.id === rid))
		.filter(Boolean) as JournalView[];
	const incomingNotes = (relatedNotesData?.filter((n) => n.relatedNoteIds?.includes(note.id) && n.id !== note.id) ?? []) as JournalView[];
	const refTotal = outgoingNotes.length + incomingNotes.length;
	const refsIsExpandable = refTotal >= 3;
	const refsIsOpen = !refsIsExpandable || refsExpanded;

	// 深色底下的悬停操作/引用网络文字色覆盖
	const hoverActionClass = onDark
		? "text-primary-foreground/30 hover:text-primary-foreground hover:bg-primary-foreground/10"
		: "text-muted-foreground/30 hover:text-[var(--card-accent)] hover:bg-[var(--card-accent)]/10";
	const moreBtnClass = onDark
		? "text-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
		: "text-muted-foreground/40 hover:bg-muted/40 hover:text-foreground";
	const refsTextClass = onDark ? "text-primary-foreground/55" : "text-muted-foreground/50";
	const refsSubClass = onDark ? "text-primary-foreground/45" : "text-muted-foreground/40";
	const dividerClass = onDark ? "border-primary-foreground/15" : "border-border/60";

	return (
		<motion.div
			initial={{ opacity: 0, y: 14 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
			style={{ "--card-accent": cfg.accent } as CSSProperties}
			className={`group relative flex w-full flex-col overflow-hidden rounded-[16px] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-14px_rgba(0,0,0,0.16)] aspect-[5/7] font-body ${cfg.wrap}`}
			onMouseMove={(e) => {
				const el = e.currentTarget;
				const r = el.getBoundingClientRect();
				el.style.setProperty("--sx", `${e.clientX - r.left}px`);
				el.style.setProperty("--sy", `${e.clientY - r.top}px`);
			}}
		>
			{/* 装饰：顶部主色条（杂志卡） */}
			{cfg.decoration === "topbar" && (
				<div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--card-accent)]" />
			)}
			{/* 装饰：胶带（便签卡） */}
			{cfg.decoration === "tape" && (
				<div className="pointer-events-none absolute left-1/2 top-[-8px] h-5 w-[60px] -translate-x-1/2 rounded-sm bg-[#786428]/20" />
			)}
			{/* 装饰：时间轴圆点 */}
			{cfg.decoration === "dot" && (
				<div className="pointer-events-none absolute left-[-7px] top-8 h-[11px] w-[11px] rounded-full border-2 border-card bg-[var(--card-accent)]" />
			)}

			{/* 游标高光（克制，仅浅色底） */}
			{!onDark && (
				<div
					className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					style={{
						background:
							"radial-gradient(180px circle at var(--sx, 30%) var(--sy, 0%), oklch(var(--primary) / 0.06), transparent 70%)",
					}}
				/>
			)}
			{/* 置顶标记 */}
			{pinned && (
				<div className={`absolute left-0 top-5 bottom-5 w-[3px] rounded-full ${onDark ? "bg-primary-foreground/60" : "bg-[var(--card-accent)]/60"}`} />
			)}

			{/* 卡片时间戳：左上角大字时间 + 小字 mono 日期（对齐参考 .card-title / .card-time），右下为"来自待办"徽标 */}
			<div className={`flex items-baseline gap-2 ${cfg.timeRow}`}>
				<span className={`inline-flex items-baseline gap-1.5 font-display font-semibold tabular-nums ${cfg.timeBig}`}>
					<span className="leading-none">{formatTime(note.createdAt).slice(11)}</span>
					<span className={`font-mono text-xs uppercase tracking-[0.04em] ${cfg.timeClass}`}>{formatTime(note.createdAt).slice(0, 10)}</span>
				</span>
				{note.origin && note.origin !== "manual" && (
					<span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${onDark ? "bg-primary-foreground/15 text-primary-foreground/85" : "bg-[var(--card-accent)]/10 text-[var(--card-accent)]/80"}`}>
						<CheckSquare className="h-2.5 w-2.5" />
						{t("todoNoteBadge")}
					</span>
				)}
			</div>

			{/* 操作图标：chat / 相似 / 更多 常驻卡片右上角，hover 卡片时淡入 */}
			<div className="absolute right-3 top-3 z-20 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
				<button
					type="button"
					onClick={onAddToChat}
					title="添加到对话"
					className={`rounded-md p-1.5 transition-all duration-150 active:scale-[0.92] ${hoverActionClass}`}
				>
					<MessageCircle className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onSimilar}
					title={t("similarNotes")}
					className={`rounded-md p-1.5 transition-all duration-150 active:scale-[0.92] ${hoverActionClass}`}
				>
					<GitFork className="h-3.5 w-3.5" />
				</button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={`rounded-md p-1.5 transition-colors active:scale-[0.92] ${moreBtnClass}`}
						>
							<MoreHorizontal className="h-3.5 w-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-[120px]">
						<DropdownMenuItem onClick={onStartEdit}>
							<Pencil className="w-3.5 h-3.5 mr-2" />
							{t("edit")}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onAnnotate}>
							<MessageSquarePlus className="w-3.5 h-3.5 mr-2" />
							批注
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onOpenLink}>
							<Link2 className="w-3.5 h-3.5 mr-2" />
							链接
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onTogglePin}>
							{pinned ? (
								<><PinOff className="w-3.5 h-3.5 mr-2" />{t("unpin")}</>
							) : (
								<><Pin className="w-3.5 h-3.5 mr-2" />{t("pin")}</>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
							<Trash2 className="w-3.5 h-3.5 mr-2" />
							{t("delete")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* 正文（字号/行高由变体控制，对齐参考 .card-body：默认 0.9375rem / 1.9） */}
			<div
				className={`relative z-10 cursor-pointer ${cfg.body}`}
				onDoubleClick={onStartEdit}
			>
				<NoteMarkdown content={bodyContent} />
				{!expanded && isLong && (
					<span className="opacity-40">{"\n"}...</span>
				)}
			</div>

			{/* 展开按钮 */}
			{isLong && (
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className={`relative z-10 mt-1.5 flex items-center gap-1 text-xs transition-colors active:scale-[0.97] ${onDark ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-[var(--card-accent)]/70 hover:text-[var(--card-accent)]"}`}
				>
					{expanded ? (
						<><ChevronUp className="w-3 h-3" />{" "}</>
					) : (
						<><ChevronDown className="w-3 h-3" />{" "}({contentLines.length})</>
					)}
				</button>
			)}

			{/* 分隔线 + 底部元信息（贴底排列，参考网页竖向卡片底部对齐） */}
			<div className={`relative z-10 mt-auto border-t border-dashed pt-3 ${dividerClass}`}>
				{/* 引用网络（对齐参考 .card-quote：分隔线/背景块 + 左竖线，置于标签上方，紧跟正文） */}
				{refTotal > 0 && (
					<div className={`relative z-10 text-xs leading-[1.85] ${cfg.refWrap}`}>
						{refsIsExpandable && (
							<button
								type="button"
								onClick={() => setRefsExpanded((v) => !v)}
								className={`flex items-center gap-1.5 font-medium transition-colors active:scale-[0.97] ${refsTextClass} ${onDark ? "hover:text-primary-foreground/80" : "hover:text-[var(--card-accent)]/70"}`}
							>
								{refsIsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
								<span>引用{outgoingNotes.length}条笔记，被{incomingNotes.length}条笔记引用</span>
							</button>
						)}
						{refsIsOpen && outgoingNotes.length > 0 && outgoingNotes.map((ref) => (
							<button
								key={ref.id}
								type="button"
								onClick={() => onOpenReference(note)}
								className={`mt-1.5 flex w-full items-start gap-1.5 text-left transition-colors active:scale-[0.99] ${refsTextClass} ${onDark ? "hover:text-primary-foreground/80" : "hover:text-[var(--card-accent)]/70"}`}
							>
								<span className={`mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${onDark ? "bg-primary-foreground/15" : "bg-[var(--card-accent)]/10"}`}>
									<ArrowUpRight className={`h-2 w-2 ${onDark ? "text-primary-foreground/70" : "text-[var(--card-accent)]/60"}`} />
								</span>
								<span className={`min-w-0 flex-1 break-words text-left leading-relaxed line-clamp-1 ${refsSubClass}`}>
									{((ref.name ?? "") + " " + (ref.userNotes ?? "").slice(0, 80)).trim()}
								</span>
							</button>
						))}
						{refsIsOpen && incomingNotes.length > 0 && incomingNotes.map((ref) => (
							<button
								key={ref.id}
								type="button"
								onClick={() => onOpenReference(note)}
								className={`mt-1.5 flex w-full items-start gap-1.5 text-left transition-colors active:scale-[0.99] ${refsTextClass} ${onDark ? "hover:text-primary-foreground/80" : "hover:text-[var(--card-accent)]/70"}`}
							>
								<span className={`mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${onDark ? "bg-primary-foreground/15" : "bg-[var(--card-accent)]/10"}`}>
									<ArrowDownLeft className={`h-2 w-2 ${onDark ? "text-primary-foreground/70" : "text-[var(--card-accent)]/60"}`} />
								</span>
								<span className={`min-w-0 flex-1 break-words text-left leading-relaxed line-clamp-1 ${refsSubClass}`}>
									{((ref.name ?? "") + " " + (ref.userNotes ?? "").slice(0, 80)).trim()}
								</span>
							</button>
						))}
					</div>
				)}

				{/* 相关待办 */}
				{note.relatedTodos && note.relatedTodos.length > 0 && (
					<div className={`mb-2 flex flex-wrap items-center gap-1.5 ${cfg.name === "quote" ? "justify-center" : ""}`}>
						{note.relatedTodos.map((td) => (
							<span
								key={td.id}
								className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${onDark ? "border-primary-foreground/20 text-primary-foreground/75" : "border-[var(--card-accent)]/20 bg-[var(--card-accent)]/5 text-[var(--card-accent)]/75"}`}
							>
								<CheckSquare className={`h-3 w-3 ${onDark ? "text-primary-foreground/60" : "text-[var(--card-accent)]/60"}`} />
								{t("linkedTodo")}{td.name}
							</span>
						))}
					</div>
				)}

				{/* #tag */}
				{note.tags.length > 0 && (
					<div className={`mb-2 flex flex-wrap gap-1.5 ${cfg.name === "quote" ? "justify-center" : ""}`}>
						{note.tags.map((tag) => (
							<span
								key={tag.tagName}
								className={`inline-flex items-center rounded-[50px] px-[10px] py-[3px] font-body text-xs tracking-[0.02em] ${cfg.tag}`}
							>
								#{tag.tagName}
							</span>
						))}
					</div>
				)}
			</div>
		</motion.div>
	);
}
