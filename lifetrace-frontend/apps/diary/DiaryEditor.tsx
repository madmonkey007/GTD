"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
	ChevronDown,
	ChevronUp,
	Clock,
	Send,
	MoreHorizontal,
	Pencil,
	Pin,
	PinOff,
	Trash2,
	GitFork,
	TriangleAlert,
	Check,
	X,
	RefreshCw,
	MessageSquarePlus,
	ArrowUpLeft,
	Search,
	MessageCircle,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { JournalDraft } from "@/apps/diary/types";
import type { JournalView } from "@/lib/query";
import { useJournals } from "@/lib/query";

import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DiaryTiptapEditor } from "./DiaryTiptapEditor";
import { useNoteChatStore } from "@/lib/store/note-chat-store";

export type DiaryFilterMode = "all" | "last7" | "random";

function extractTagsFromContent(content: string): string[] {
	const matches = content.match(/#([^\s#]+)(\s|$)/g);
	if (!matches) return [];
	return [...new Set(matches.map((m) => m.slice(1).trimEnd()))];
}

// 笔记卡片 markdown 渲染组件：支持列表、粗体、标题等，#tag 通过 rehypeRaw 渲染 HTML 标签

function NoteMarkdown({ content }: { content: string }) {
	// 预处理：把所有 #tag 替换成 HTML <span> 标签
	// 使用 rehypeRaw 插件允许 HTML 在 markdown 中渲染
	const processedContent = content.replace(
		/#(\S+)/g,
		'<span class="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground align-middle">#$1</span>'
	);
	return (
		<div className="text-xs text-muted-foreground leading-relaxed">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={{
					p: ({ children }: { children?: React.ReactNode }) => (
						<p className="my-0 leading-relaxed">{children}</p>
					),
					ul: ({ children }: { children?: React.ReactNode }) => (
						<ul className="my-0 list-disc pl-4 space-y-0">{children}</ul>
					),
					ol: ({ children }: { children?: React.ReactNode }) => (
						<ol className="my-0 list-decimal pl-4 space-y-0">{children}</ol>
					),
					li: ({ children }: { children?: React.ReactNode }) => (
						<li className="leading-relaxed">{children}</li>
					),
					strong: ({ children }: { children?: React.ReactNode }) => (
						<strong className="font-semibold">{children}</strong>
					),
					em: ({ children }: { children?: React.ReactNode }) => (
						<em className="italic">{children}</em>
					),
					h1: ({ children }: { children?: React.ReactNode }) => (
						<h1 className="text-xs font-bold mb-0.5">{children}</h1>
					),
					h2: ({ children }: { children?: React.ReactNode }) => (
						<h2 className="text-xs font-semibold mb-0.5">{children}</h2>
					),
					h3: ({ children }: { children?: React.ReactNode }) => (
						<h3 className="text-[11px] font-semibold mb-0.5">{children}</h3>
					),
					code: ({ children }: { children?: React.ReactNode }) => (
						<code className="px-1 py-0.5 rounded text-[11px] font-mono bg-muted/40">{children}</code>
					),
				}}
			>
				{processedContent}
			</ReactMarkdown>
		</div>
	);
}

interface DiaryEditorProps {
	draft: JournalDraft;
	filterMode: DiaryFilterMode;
	tagFilter?: string | null;
	onTitleChange: (value: string) => void;
	onUserNotesChange: (value: string) => void;
	onUserNotesBlur: (value: string) => void;
	heatmapFilterDate?: Date | null;
	onClearHeatmapFilter?: () => void;
	pinnedIds: number[];
	onDelete: (note: JournalView) => void;
	onTogglePin: (journalId: number) => void;
	onSubmit: () => void;
	onSaveCardEdit: (journalId: number, data: { name?: string | null; user_notes?: string | null }) => Promise<void>;
	onInlineTag?: (tagName: string) => void;
	similarToNoteId?: number | null;
	onSimilarClick?: (noteId: number) => void;
	onClearSimilarFilter?: () => void;
	recentTags?: string[];
	onAnnotate?: (note: JournalView) => void;
	onCompareNotes?: (sourceNote: JournalView, currentNote: JournalView) => void;
	relatedNotesData?: JournalView[];
	showLeftToggle?: boolean;
	showRightToggle?: boolean;
	isLeftOpen?: boolean;
	isRightOpen?: boolean;
	onToggleLeft?: () => void;
	onToggleRight?: () => void;
}

export function DiaryEditor({
	draft,
	filterMode,
	tagFilter,
	heatmapFilterDate,
	onClearHeatmapFilter,
	onTitleChange,
	onUserNotesChange,
	onUserNotesBlur,
	pinnedIds,
	onDelete,
	onTogglePin,
	onSubmit,
	onSaveCardEdit,
	onInlineTag,
	similarToNoteId,
	onSimilarClick,
	onClearSimilarFilter,
	recentTags = [],
	onAnnotate,
	onCompareNotes,
	relatedNotesData,
	showLeftToggle = false,
	showRightToggle = false,
	isLeftOpen = false,
	isRightOpen = false,
	onToggleLeft,
	onToggleRight,
}: DiaryEditorProps) {
	const t = useTranslations("journalPanel");
	const locale = useLocale();
	const autoFilledRef = { current: false };
		const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
	const [deleteDialogNote, setDeleteDialogNote] = useState<JournalView | null>(null);
	const addLinkedNote = useNoteChatStore((s) => s.addLinkedNote);
	const [editingCardId, setEditingCardId] = useState<number | null>(null);
	const [editName, setEditName] = useState("");
	const [editContent, setEditContent] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [randomShuffle, setRandomShuffle] = useState(0);
		const [searchQuery, setSearchQuery] = useState("");
		const [debouncedSearch, setDebouncedSearch] = useState("");
	const PAGE_SIZE = 20;
	const [notesOffset, setNotesOffset] = useState(0);
	const [allNotes, setAllNotes] = useState<JournalView[]>([]);
	const [hasMore, setHasMore] = useState(true);
		const sentinelRef = useRef<HTMLDivElement>(null);


	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);


		const journalQuery = useMemo(() => {
		const params: Record<string, unknown> = { limit: PAGE_SIZE, offset: notesOffset };
		if (filterMode === "last7") {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
			const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
			params.startDate = start.toISOString();
			params.endDate = end.toISOString();
		} else if (heatmapFilterDate) {
			const start = new Date(heatmapFilterDate);
			start.setHours(0, 0, 0, 0);
			const end = new Date(heatmapFilterDate);
			end.setHours(23, 59, 59, 999);
			params.startDate = start.toISOString();
			params.endDate = end.toISOString();
		}
		if (debouncedSearch.trim()) {
			params.search = debouncedSearch.trim();
		}
		return params;
	}, [filterMode, heatmapFilterDate, debouncedSearch, notesOffset]);

		const { data: notesData, isLoading: _isNotesLoading, isFetching: isNotesFetching } = useJournals(journalQuery);
	// 分页累计：当新数据返回时追加到 allNotes
	useEffect(() => {
		if (!notesData) return;
		const { journals, total } = notesData;
		if (notesOffset === 0) {
			setAllNotes(journals);
		} else {
			setAllNotes(prev => {
				const existing = new Set(prev.map(n => n.id));
				const newNotes = journals.filter(n => !existing.has(n.id));
				return [...prev, ...newNotes];
			});
		}
		const loadedCount = notesOffset === 0 ? journals.length : allNotes.length + journals.length;
		setHasMore(loadedCount < total);
	}, [notesData, notesOffset]);

	// 筛选条件变化时重置分页
	useEffect(() => {
		setNotesOffset(0);
		setAllNotes([]);
		setHasMore(true);
	}, [filterMode, heatmapFilterDate, debouncedSearch]);

	// 滚动加载更多（IntersectionObserver）
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(entries => {
			if (entries[0].isIntersecting && hasMore && !isNotesFetching) {
				setNotesOffset(prev => prev + PAGE_SIZE);
			}
		}, { rootMargin: "200px" });
		observer.observe(el);
		return () => observer.disconnect();
	}, [hasMore, isNotesFetching]);


	useEffect(() => {
		if (!draft.name && !draft.userNotes) {
			autoFilledRef.current = false;
		}
	}, [draft.name, draft.userNotes]);


	const startEditing = (note: JournalView) => {
		setEditingCardId(note.id);
		setEditName(note.name ?? "");
		setEditContent(note.userNotes ?? "");
	};

	const cancelEditing = () => {
		setEditingCardId(null);
		setEditName("");
		setEditContent("");
	};


	const handleSaveEdit = async () => {
		if (editingCardId === null) return;
		setIsSaving(true);
		try {
			await onSaveCardEdit(editingCardId, {
				name: editName || null,
				user_notes: editContent || null,
			});
			cancelEditing();
		} catch (err) {
			console.error("[saveCardEdit] API error:", err);
		} finally {
			setIsSaving(false);
		}
	};


	const toggleCard = (id: number) => {
		setExpandedCards((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

		const notesList = allNotes;
	const sortedNotes = useMemo(() => {
		let filtered = notesList;

		// Filter by similar notes: show only notes sharing tags with the target
		if (similarToNoteId) {
			const targetNote = notesList.find((j) => j.id === similarToNoteId);
			const targetTags = new Set((targetNote?.tags ?? []).map((t) => t.tagName));
			if (targetTags.size > 0) {
				filtered = notesList.filter((j) =>
					(j.tags ?? []).some((t) => targetTags.has(t.tagName)),
				);
			}
		}

		if (tagFilter) {
			filtered = notesList.filter((j) =>
				(j.tags ?? []).some((t) => t.tagName === tagFilter),
			);
		}
		const sorted = [...filtered].sort((a, b) => {
			const aPinned = pinnedIds.includes(a.id);
			const bPinned = pinnedIds.includes(b.id);
			if (aPinned && !bPinned) return -1;
			if (!aPinned && bPinned) return 1;
			return 0;
		});
		if (filterMode === "random") {
			void randomShuffle;
			const shuffled = [...sorted].sort(() => Math.random() - 0.5);
			return shuffled.slice(0, 3);
		}
		return sorted;
	}, [notesList, pinnedIds, filterMode, tagFilter, similarToNoteId, randomShuffle]);

	const formatTime = (dateStr: string) => {
		const d = new Date(dateStr);
		return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
			{/* Input area - auto-expanding (hidden when searching or filtering) */}
			{/* Search bar */}
			<div className="relative mt-2 mb-2 mx-4 flex items-center gap-1">
				{showLeftToggle && (
					<button
						type="button"
						onClick={onToggleLeft}
						className={`flex-shrink-0 p-1 -ml-1 transition-colors ${isLeftOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<line x1="3" y1="6" x2="21" y2="6"/>
							<line x1="3" y1="12" x2="21" y2="12"/>
							<line x1="3" y1="18" x2="21" y2="18"/>
						</svg>
					</button>
				)}
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="搜索笔记..."
						className="w-full h-8 rounded-lg border border-border/30 bg-background/50 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] transition-all duration-200"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					)}
				</div>
				{showRightToggle && (
					<button
						type="button"
						onClick={onToggleRight}
						className={`flex-shrink-0 p-1 -mr-1 transition-colors ${isRightOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
						</svg>
					</button>
				)}
			</div>
						{!debouncedSearch && !heatmapFilterDate && !tagFilter && !similarToNoteId && (
				<div className="px-4 pt-2 pb-2">
					<DiaryTiptapEditor
						variant="create"
						value={draft.userNotes}
						onChange={(v) => {
							onUserNotesChange(v);
							if (!draft.name && !autoFilledRef.current && v.trim()) {
								autoFilledRef.current = true;
								const now = new Date();
								const y = now.getFullYear();
								const mo = String(now.getMonth() + 1).padStart(2, "0");
								const d = String(now.getDate()).padStart(2, "0");
								const h = String(now.getHours()).padStart(2, "0");
								const mi = String(now.getMinutes()).padStart(2, "0");
								onTitleChange(y + "-" + mo + "-" + d + " " + h + ":" + mi);
							}
							const newTags = extractTagsFromContent(v);
							for (const tag of newTags) {
								if (!draft.tags.includes(tag)) onInlineTag?.(tag);
							}
						}}
						onBlur={() => onUserNotesBlur(draft.userNotes)}
						recentTags={recentTags}
						onInlineTag={onInlineTag}
						placeholder={t("contentPlaceholder")}
						toolbarEnd={
							<button type="button" onMouseDown={(e) => { e.preventDefault(); if (draft.userNotes.trim()) { onSubmit(); } }} disabled={!draft.userNotes.trim()} className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 active:scale-[0.97]">
								<Send className="w-3.5 h-3.5" />
							</button>
						}
					/>
				</div>
			)}
			{/* Notes list - remaining */}
			<div className="px-4 py-3 space-y-2">
				{debouncedSearch && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<span className="text-xs font-medium text-primary/80 bg-primary/8 rounded-full px-2.5 py-1 border border-primary/10">
							搜索: "{debouncedSearch}"
						</span>
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
						>
							清除
						</button>
					</div>
				)}
				{heatmapFilterDate && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<span className="text-xs font-medium text-primary/80 bg-primary/8 rounded-full px-2.5 py-1 border border-primary/10">
							{heatmapFilterDate.getFullYear()}-{String(heatmapFilterDate.getMonth() + 1).padStart(2, "0")}-{String(heatmapFilterDate.getDate()).padStart(2, "0")}
						</span>
						<button
							type="button"
							onClick={onClearHeatmapFilter}
							className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
						>
							{t("sidebarFilterAll")}
						</button>
					</div>
				)}
				{filterMode === "random" && (
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-medium text-primary/70">{t("sidebarFilterRandom")}</span>
						<button
							type="button"
							onClick={() => { setRandomShuffle((prev) => prev + 1) }}
							className="rounded-lg p-1.5 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all duration-200"
							title={t("sidebarFilterRandom")}
						>
							<RefreshCw className="w-3.5 h-3.5" />
						</button>
					</div>
				)}
				{tagFilter && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<span className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary/80 border border-primary/10">
							# {tagFilter}
						</span>
					</div>
				)}
				{similarToNoteId && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<GitFork className="w-3.5 h-3.5 text-primary/40" />
						<span className="text-xs font-medium text-primary/80">
							{t("similarToNote")}
						</span>
						<button
							type="button"
							onClick={onClearSimilarFilter}
							className="text-xs text-muted-foreground hover:text-foreground underline transition-colors ml-1"
						>
							{t("clearSimilarFilter")}
						</button>
					</div>
				)}
				{isNotesFetching && notesOffset === 0 ? (
					// 骨架屏加载效果
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="rounded-xl border border-border/30 bg-card px-4 py-3 animate-pulse">
								<Skeleton className="h-3 bg-muted rounded w-3/4 mb-2" />
								<Skeleton className="h-2.5 bg-muted rounded w-full mb-1.5" />
								<Skeleton className="h-2.5 bg-muted rounded w-2/3 mb-2" />
								<div className="flex gap-2">
									<Skeleton className="h-4 bg-muted rounded-full w-12" />
									<Skeleton className="h-4 bg-muted rounded-full w-16" />
								</div>
							</div>
						))}
					</div>
				) : allNotes.length === 0 ? (
					<div className="text-xs text-muted-foreground/50 italic text-center pt-8">
						{locale === "zh" ? "暂无笔记" : "No notes yet"}
					</div>
				) : (
					sortedNotes.map((note) => {
						const isExpanded = expandedCards.has(note.id);
						const contentLines = note.userNotes?.split("\n") ?? [];
						const isLong = contentLines.length > 20;
						const displayContent = isExpanded ? contentLines : contentLines.slice(0, 20);
						const isEditing = editingCardId === note.id;

						return (
						<div key={note.id}>

							<motion.div
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
								className={"group w-full rounded-xl border px-4 py-3 transition-all duration-200 "
									+ (isEditing
										? "border-primary/50 ring-1 ring-primary/20 bg-background"
										: draft.id === note.id
											? "border-primary/30 bg-primary/[0.02] ring-1 ring-primary/10"
											: "border-border/30 bg-card hover:border-border/60 hover:bg-muted/[0.02]")
									+ (pinnedIds.includes(note.id) ? " relative" : "")}
							>
																	{isEditing ? (
						// --- Inline edit mode ---
						<div className="space-y-2">
							<input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t("titlePlaceholder")} className="w-full text-sm font-semibold bg-transparent border-b border-border/40 pb-1 focus-visible:outline-none focus-visible:border-primary/40" />
							<DiaryTiptapEditor variant="edit" value={editContent} onChange={setEditContent} recentTags={recentTags} placeholder={t("contentPlaceholder")}
								toolbarEnd={
									<>
										<button type="button" onClick={cancelEditing} disabled={isSaving} className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"><X className="w-3.5 h-3.5" />{t("cancel")}</button>
										<button type="button" onClick={handleSaveEdit} disabled={isSaving} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"><Check className="w-3.5 h-3.5" />{isSaving ? t("saving") : t("save")}</button>
									</>
								}
							/>
							{(function() { const editTags = extractTagsFromContent(editContent); if (editTags.length === 0) return null; return (<div className="flex flex-wrap gap-1 px-0.5 pb-1">{editTags.map(function(tag) { return <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">#{tag}</span>; })}</div>); })()}
						</div>
) : (
		// --- Display mode ---
									<>
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 min-w-0">
												{note.name && (
													<div className="text-[10px] text-muted-foreground/50 mb-1 truncate">
														{pinnedIds.includes(note.id) && (
															<Pin className="w-3 h-3 inline-block mr-1 text-primary/60 -mt-0.5" />
														)}
														{note.name}
													</div>
												)}
											</div>
											{!isEditing && (
												<>
													<button
														type="button"
											onClick={(e) => { e.stopPropagation(); addLinkedNote({ id: note.id, name: note.name, userNotes: note.userNotes, date: note.date, tags: note.tags.map((t) => t.tagName) }); }}
														title={locale === "zh" ? "添加到对话" : "Add to chat"}
														className="rounded p-1 -mt-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
													>
														<MessageCircle className="w-3.5 h-3.5" />
													</button>
													<button
														type="button"
														onClick={(e) => { e.stopPropagation(); onSimilarClick?.(note.id); }}
														title={t("similarNotes")}
														className="rounded p-1 -mt-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
													>
														<GitFork className="w-3.5 h-3.5" />
													</button>
												</>
											)}
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<button
														type="button"
														className="rounded p-1 text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors -mr-1 -mt-1 flex-shrink-0"
													>
														<MoreHorizontal className="w-3.5 h-3.5" />
													</button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="min-w-[120px]">
													<DropdownMenuItem onClick={() => startEditing(note)}>
														<Pencil className="w-3.5 h-3.5 mr-2" />
														{t("edit")}
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => onAnnotate?.(note)}>
														<MessageSquarePlus className="w-3.5 h-3.5 mr-2" />
														批注
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => onTogglePin(note.id)}>
														{pinnedIds.includes(note.id) ? (
															<><PinOff className="w-3.5 h-3.5 mr-2" />{t("unpin")}</>
														) : (
															<><Pin className="w-3.5 h-3.5 mr-2" />{t("pin")}</>
														)}
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => setDeleteDialogNote(note)}
														className="text-destructive focus:text-destructive"
													>
														<Trash2 className="w-3.5 h-3.5 mr-2" />
														{t("delete")}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
										<div
											className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
											onDoubleClick={() => startEditing(note)}
										>
											<NoteMarkdown content={displayContent.join("\n")} />
											{!isExpanded && isLong && (
												<span className="text-muted-foreground/40">{"\n"}...</span>
											)}
										</div>
										{isLong && (
											<button
												type="button"
												onClick={() => toggleCard(note.id)}
												className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary mt-1 transition-colors"
											>
												{isExpanded ? (
													<><ChevronUp className="w-3 h-3" />{" "}</>
												) : (
													<><ChevronDown className="w-3 h-3" />{" "}({contentLines.length})</>
												)}
											</button>
										)}
										<div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/50 hidden">
											<Clock className="w-3 h-3 text-muted-foreground/40" />
											{formatTime(note.createdAt)}
										</div>
										{note.relatedNoteIds && note.relatedNoteIds.length > 0 && (() => {
											const refNote = notesList.find(n => n.id === note.relatedNoteIds[0]) ?? relatedNotesData?.find(n => n.id === note.relatedNoteIds[0]);
											if (!refNote) return null;
											const firstLine = (refNote.userNotes || '').split('\n')[0] || '';
											return (
												<button
													type="button"
													onClick={() => onCompareNotes?.(refNote, note)}
													className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground/50 hover:text-primary/70 transition-colors group/reflink w-full text-left"
												>
													<span className="w-3 h-3 rounded-full bg-foreground/20 flex items-center justify-center shrink-0">
														<ArrowUpLeft className="w-2 h-2 text-background" />
													</span>
													<span className="truncate">{formatTime(refNote.createdAt)} {firstLine}</span>
												</button>
											);
										})()}
									</>
								)}
							</motion.div>
						</div>
						);
					})
				)}
				<AlertDialog open={deleteDialogNote !== null} onOpenChange={(open) => { if (!open) setDeleteDialogNote(null); }}>
					<AlertDialogContent className="p-0 gap-0 overflow-hidden max-w-sm border-l-[3px] border-l-destructive/40 shadow-xl">
						<div className="flex gap-4 p-6 pb-5">
							<div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center ring-1 ring-destructive/20">
								<TriangleAlert className="w-5 h-5 text-destructive" />
							</div>
							<div className="flex-1 min-w-0 pt-0.5">
								<AlertDialogHeader className="space-y-1 p-0">
									<AlertDialogTitle className="text-base font-semibold">{t("deleteConfirmTitle")}</AlertDialogTitle>
									<AlertDialogDescription className="text-sm text-muted-foreground/70 leading-relaxed">
										{t("deleteConfirmMessage")}
									</AlertDialogDescription>
								</AlertDialogHeader>
							</div>
						</div>
						<div className="h-px bg-border/40" />
						<AlertDialogFooter className="px-6 py-3.5 sm:justify-end gap-2">
							<AlertDialogCancel className="relative rounded-lg h-9 px-4 text-xs font-medium border border-border/60 bg-background hover:bg-muted/40 hover:text-foreground transition-all active:scale-[0.97]">
								{t("cancel")}
							</AlertDialogCancel>
							<AlertDialogAction
								className="relative rounded-lg h-9 px-4 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.97] transition-all shadow-sm"
								onClick={() => {
									if (deleteDialogNote !== null) onDelete(deleteDialogNote);
									setDeleteDialogNote(null);
								}}
							>
								{t("delete")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				
				</div>
			</div>
		</div>
	);
}
