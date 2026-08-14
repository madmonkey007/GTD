"use client";

import { useRef, useState, useMemo, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
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
	ArrowUpRight,
	ArrowDownLeft,
	MessageCircle,
	Link2,
	CheckSquare,
	Plus,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { JournalDraft } from "@/apps/diary/types";
import type { JournalView } from "@/lib/query";
import { useJournals } from "@/lib/query";
import { queryKeys } from "@/lib/query/keys";
import { unwrapApiData } from "@/lib/api/fetcher";
import { cn } from "@/lib/utils";

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
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { DiaryTiptapEditor, type NoteLinkItem } from "./DiaryTiptapEditor";
import { DiarySearchBar } from "./components/DiarySearchBar";
import { ReferenceModal } from "./components/ReferenceModal";
import { AddNoteLinkModal } from "./components/AddNoteLinkModal";
import { NoteMarkdown } from "./components/NoteMarkdown";
import { TimeMachineHeader } from "./components/TimeMachineHeader";
import { TimeMachineNoteCard } from "./components/TimeMachineNoteCard";
import { TimeMachineCarousel } from "./components/TimeMachineCarousel";
import { useNoteChatStore } from "@/lib/store/note-chat-store";
import { useJournalStore } from "@/lib/store/journal-store";

export type DiaryFilterMode = "all" | "last7" | "random" | "todo";

function extractTagsFromContent(content: string): string[] {
	const matches = content.match(/#([^\s#]+)(\s|$)/g);
	if (!matches) return [];
	return [...new Set(matches.map((m) => m.slice(1).trimEnd()))];
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
	/** 时光机：随机穿越到的日期（优先于 heatmapFilterDate） */
	timeMachineDate?: Date | null;
	/** 时光机：动画展示中的目标日期（尚未落定，不触发数据加载） */
	timeMachinePending?: Date | null;
	/** 时光机动画落定：通知父组件把 pending 日期 commit 为真实筛选日期 */
	onTimeMachineSettled?: () => void;
	/** 时光机：点击「发射」重新随机穿越到另一天 */
	onTimeMachineLaunch?: () => void;
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
	noteLinkList?: NoteLinkItem[];
	onLinkNote?: (noteId: number, sourceId?: number) => void;
	onRemoveLink?: (noteId: number) => void;
	linkedNoteTitles?: { id: number; name: string }[];
	relatedNotesData?: JournalView[];
	showLeftToggle?: boolean;
	showRightToggle?: boolean;
	isLeftOpen?: boolean;
	isRightOpen?: boolean;
	onToggleLeft?: () => void;
	onToggleRight?: () => void;
	/** 提交成功后自增的信号，重置分页到第一页（新建笔记出现在列表顶部） */
	notesResetSignal?: number;
	/** 项目过滤模式：仅展示属于这些笔记 ID 的笔记（卡片渲染与全部笔记完全一致） */
	filterJournalIds?: number[] | null;
	/** 渲染在笔记区顶部（输入区上方）的自定义头部，如项目标题栏 */
	headerSlot?: ReactNode;
}

export function DiaryEditor({
	draft,
	filterMode,
	tagFilter,
	heatmapFilterDate,
	onClearHeatmapFilter,
	timeMachineDate,
	timeMachinePending,
	onTimeMachineSettled,
	onTimeMachineLaunch,
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
	// onCompareNotes, // kept in interface for upstream
	noteLinkList,
	onLinkNote,
	onRemoveLink,
	linkedNoteTitles,
	relatedNotesData,
	showLeftToggle = false,
	showRightToggle = false,
	isLeftOpen = false,
	isRightOpen = false,
	onToggleLeft,
	onToggleRight,
	notesResetSignal = 0,
	filterJournalIds,
	headerSlot,
}: DiaryEditorProps) {
	const t = useTranslations("journalPanel");
	const locale = useLocale();
	const isMobile = useIsMobile();
	// 时光机器沉浸模式：动画中或已落定，独占顶部（隐藏视图切换/搜索/输入框）
	const isTimeMachineMode = !!(timeMachinePending || timeMachineDate);
	// 时光机卡片样式：随机 = 按笔记 id 分配；固定 = 全部使用选中的风格
	const timeMachineStyleMode = useJournalStore((s) => s.timeMachineStyleMode);
	const timeMachineStyle = useJournalStore((s) => s.timeMachineStyle);
	const autoFilledRef = { current: false };
		const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
		const [refsExpanded, setRefsExpanded] = useState<Set<number>>(new Set());
	const [deleteDialogNote, setDeleteDialogNote] = useState<JournalView | null>(null);
	const addLinkedNote = useNoteChatStore((s) => s.addLinkedNote);
	const [editingCardId, setEditingCardId] = useState<number | null>(null);
	const [editName, setEditName] = useState("");
	const [editContent, setEditContent] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [randomShuffle, setRandomShuffle] = useState(0);
	const [referenceViewNote, setReferenceViewNote] = useState<JournalView | null>(null);
	const [addLinkNote, setAddLinkNote] = useState<JournalView | null>(null);
		const [searchQuery, setSearchQuery] = useState("");
		const [debouncedSearch, setDebouncedSearch] = useState("");
	const [viewMode, setViewMode] = useState<"single" | "double">(() => {
		if (typeof window === "undefined") return "single";
		return localStorage.getItem("diary-view-mode") === "double" ? "double" : "single";
	});
	// 移动端：搜索框收起为图标按钮，点击展开；输入区收起为右下角悬浮 + 按钮，点击从底部弹出
	const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
	const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
	const PAGE_SIZE = 20;
	const [notesOffset, setNotesOffset] = useState(0);
	const [allNotes, setAllNotes] = useState<JournalView[]>([]);
	const [hasMore, setHasMore] = useState(true);
		const sentinelRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();
	const loadedPagesRef = useRef(0);


	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	useEffect(() => {
		localStorage.setItem("diary-view-mode", viewMode);
	}, [viewMode]);


		const journalQuery = useMemo(() => {
		const params: Record<string, unknown> = filterJournalIds
			? { limit: 500, offset: 0 }
			: { limit: PAGE_SIZE, offset: notesOffset };
		if (filterMode === "todo") {
			// 待办笔记：背景镜像 + 备注镜像
			params.origins = "todo_background,todo_notes";
		} else if (filterMode === "last7") {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
			const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
			params.startDate = start.toISOString();
			params.endDate = end.toISOString();
		} else if (timeMachineDate) {
			// 时光机：筛选穿越到的那一天
			const start = new Date(timeMachineDate);
			start.setHours(0, 0, 0, 0);
			const end = new Date(timeMachineDate);
			end.setHours(23, 59, 59, 999);
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
	}, [filterMode, heatmapFilterDate, timeMachineDate, debouncedSearch, notesOffset, filterJournalIds]);

		const { data: notesData, isLoading: _isNotesLoading, isFetching: isNotesFetching } = useJournals(journalQuery);
		// 分页累计：当新数据返回时追加到 allNotes。
		// offset=0 且已累积多页时，用 fetchQuery 等待所有已加载页刷新后再重建列表，
		// 确保链接创建/删除后 relatedNoteIds 等字段保持最新。
		useEffect(() => {
			if (!notesData) return;
			const { journals, total } = notesData;
			if (notesOffset === 0) {
				if (loadedPagesRef.current > 1) {
					const pagesToLoad = loadedPagesRef.current;
					loadedPagesRef.current = 0;
					(async () => {
						const all: JournalView[] = [...journals];
						for (let p = 1; p < pagesToLoad; p++) {
							const raw = await queryClient.fetchQuery({
								queryKey: queryKeys.journals.list({ limit: PAGE_SIZE, offset: p * PAGE_SIZE }),
							});
							const fresh = unwrapApiData<{ journals: JournalView[]; total: number }>(raw);
							if (fresh?.journals) {
								all.push(...fresh.journals);
							}
						}
						setAllNotes(all);
					})();
				} else {
					setAllNotes(journals);
				}
			} else {
				loadedPagesRef.current = Math.max(loadedPagesRef.current, Math.floor(notesOffset / PAGE_SIZE) + 1);
				setAllNotes((prev) => {
					const existing = new Set(prev.map((n) => n.id));
					const newNotes = journals.filter((n) => !existing.has(n.id));
					return newNotes.length > 0 ? [...prev, ...newNotes] : prev;
				});
			}
			const loadedCount = notesOffset + journals.length;
			setHasMore(loadedCount < total);
		}, [notesData, notesOffset]);

	// 筛选条件变化时重置分页并清空已累积的旧页。
	// 用 ref 比较真实变化，避免挂载时（含开发环境 StrictMode 对 effect 的二次触发）误清空 allNotes：
	// 挂载时上面的合并 effect 已从缓存填充 allNotes，此处再清空会因 notesData 引用稳定、
	// 合并 effect 不再触发而无法回填，导致切走再切回笔记面板时列表变空。
	const prevFiltersRef = useRef({ filterMode, heatmapFilterDate, timeMachineDate, debouncedSearch, filterJournalIds });
	useEffect(() => {
		const prev = prevFiltersRef.current;
		if (
			prev.filterMode === filterMode &&
			prev.heatmapFilterDate === heatmapFilterDate &&
			prev.timeMachineDate === timeMachineDate &&
			prev.debouncedSearch === debouncedSearch &&
			prev.filterJournalIds === filterJournalIds
		) {
			return;
		}
		prevFiltersRef.current = { filterMode, heatmapFilterDate, timeMachineDate, debouncedSearch, filterJournalIds };
		setNotesOffset(0);
		setAllNotes([]);
		setHasMore(true);
		loadedPagesRef.current = 0;
	}, [filterMode, heatmapFilterDate, timeMachineDate, debouncedSearch, filterJournalIds]);

	// 笔记提交成功后（父组件自增 signal），重置分页到第一页，
	// 让新建的笔记出现在列表顶部（否则滚动加载后新笔记被合并逻辑丢弃）
	const prevResetSignalRef = useRef(notesResetSignal);
	useEffect(() => {
		if (notesResetSignal === prevResetSignalRef.current) return;
		prevResetSignalRef.current = notesResetSignal;
		setNotesOffset(0);
		setAllNotes([]);
		setHasMore(true);
		loadedPagesRef.current = 0;
	}, [notesResetSignal]);

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
		// 时光机器动画期间不展示任何笔记内容（时间先走完，内容再加载）
		if (timeMachinePending) return [];

		let filtered = notesList;

		// 项目过滤：仅展示属于该项目的笔记
		if (filterJournalIds) {
			const idSet = new Set(filterJournalIds);
			filtered = filtered.filter((j) => idSet.has(j.id));
		}

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
			// 用基于 randomShuffle 的伪随机打乱，保证：只在 randomShuffle 变化时换一批，
			// 其余重渲染（分页加载、状态更新）不会让随机列表抖动闪烁。
			const seed = randomShuffle;
			const mulberry32 = (a: number) => () => {
				a |= 0; a = (a + 0x6D2B79F5) | 0;
				let h = Math.imul(a ^ (a >>> 15), 1 | a);
				h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
				return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
			};
			const rng = mulberry32(seed * 2654435761);
			const tagged = sorted.map((n, i) => ({ n, k: rng() + i * 1e-9 }));
			tagged.sort((a, b) => a.k - b.k);
			return tagged.slice(0, 3).map((x) => x.n);
		}
		return sorted;
	}, [notesList, pinnedIds, filterMode, tagFilter, similarToNoteId, randomShuffle, filterJournalIds, timeMachinePending]);

	const formatTime = (dateStr: string) => {
		const d = new Date(dateStr);
		return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
	};

	return (
		<div className="flex h-full flex-col">
			{headerSlot}
			<div className={cn("flex-1 min-h-0 overflow-y-auto", isMobile && "scrollbar-none")}>
			{/* Input area - auto-expanding (hidden when searching or filtering) */}
			{/* Search bar */}
			{/* Search bar — 时光机器模式下隐藏视图切换与搜索，让沉浸式 header 独占顶部 */}
			{isTimeMachineMode ? (
				<div className="h-0 my-0 overflow-hidden" />
			) : (
				<DiarySearchBar
					isMobile={isMobile}
					showLeftToggle={showLeftToggle}
					showRightToggle={showRightToggle}
					isLeftOpen={isLeftOpen}
					isRightOpen={isRightOpen}
					onToggleLeft={onToggleLeft}
					onToggleRight={onToggleRight}
					viewMode={viewMode}
					setViewMode={setViewMode}
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
					mobileSearchOpen={mobileSearchOpen}
					setMobileSearchOpen={setMobileSearchOpen}
					locale={locale}
				/>
			)}
			{/* 新建笔记输入区 */}
			{(() => {
				const showCreateEditor =
					!debouncedSearch &&
					!heatmapFilterDate &&
					!timeMachineDate &&
					!timeMachinePending &&
					!tagFilter &&
					!similarToNoteId;

				const handleComposerChange = (v: string) => {
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
				};

				const sendButton = (
					<button
						type="button"
						onMouseDown={(e) => {
							e.preventDefault();
							if (draft.userNotes.trim()) {
								onSubmit();
								setMobileComposerOpen(false);
							}
						}}
						disabled={!draft.userNotes.trim()}
						className={cn(
							"flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30",
							isMobile && "py-2.5",
						)}
					>
						<Send className="h-3.5 w-3.5" />
					</button>
				);

				// 移动端：输入区默认收起，右下角悬浮 + 按钮；点击从底部弹出并固定在底部
				if (isMobile) {
					return (
						<>
							<AnimatePresence>
								{showCreateEditor && mobileComposerOpen && (
									<>
										<motion.div
											key="mobile-composer-backdrop"
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.15 }}
											className="fixed inset-0 z-50 bg-black/30"
											onClick={() => setMobileComposerOpen(false)}
										/>
										<motion.div
											key="mobile-composer-sheet"
											initial={{ y: "100%" }}
											animate={{ y: 0 }}
											exit={{ y: "100%" }}
											transition={{ type: "spring", damping: 30, stiffness: 300 }}
											className="fixed inset-x-0 bottom-0 z-50 bg-background shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]"
										>
											<div className="px-4 pt-3 pb-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
												<DiaryTiptapEditor
													noteLinkList={noteLinkList}
													onLinkNote={onLinkNote}
													onRemoveLink={onRemoveLink}
													linkedNoteTitles={linkedNoteTitles}
													variant="create"
													value={draft.userNotes}
													onChange={handleComposerChange}
													onBlur={() => onUserNotesBlur(draft.userNotes)}
													recentTags={recentTags}
													onInlineTag={onInlineTag}
													placeholder={t("contentPlaceholder")}
													toolbarEnd={sendButton}
												/>
											</div>
										</motion.div>
									</>
								)}
							</AnimatePresence>
							{/* 悬浮 + 按钮：仅在可写内容可见时显示，避让底部导航栏 */}
							<AnimatePresence>
								{showCreateEditor && !mobileComposerOpen && (
									<motion.button
										key="mobile-composer-fab"
										type="button"
										initial={{ opacity: 0, scale: 0.7 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.7 }}
										transition={{ duration: 0.15 }}
										onClick={() => setMobileComposerOpen(true)}
										aria-label="新建笔记"
										className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_rgba(0,0,0,0.4)] transition-transform active:scale-95"
										style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
									>
										<Plus className="h-6 w-6" />
									</motion.button>
								)}
							</AnimatePresence>
						</>
					);
				}

				// 桌面端：输入区内联在搜索栏下方
				return showCreateEditor ? (
					<div className="px-4 pt-2 pb-2">
						<DiaryTiptapEditor
							noteLinkList={noteLinkList}
							onLinkNote={onLinkNote}
							onRemoveLink={onRemoveLink}
							linkedNoteTitles={linkedNoteTitles}
							variant="create"
							value={draft.userNotes}
							onChange={handleComposerChange}
							onBlur={() => onUserNotesBlur(draft.userNotes)}
							recentTags={recentTags}
							onInlineTag={onInlineTag}
							placeholder={t("contentPlaceholder")}
							toolbarEnd={sendButton}
						/>
					</div>
				) : null;
			})()}
			{/* Notes list - remaining */}
			<div className={cn(
				isTimeMachineMode
					? "relative min-h-[60vh] pt-4 pb-10 sm:pt-6"
					: "space-y-2 pb-3",
				isMobile ? "px-2 pt-2" : "px-4 py-3",
			)}>
				{(timeMachinePending || timeMachineDate) && (
					<TimeMachineHeader
						target={timeMachinePending ?? timeMachineDate!}
						onSettled={timeMachinePending ? onTimeMachineSettled : undefined}
					/>
				)}
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
				{filterMode === "todo" && (
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-medium text-primary/70">{t("sidebarFilterTodoNotes")}</span>
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
				) : allNotes.length === 0 && !timeMachinePending ? (
					<div className="text-xs text-muted-foreground/50 italic text-center pt-8">
						{locale === "zh" ? "暂无笔记" : "No notes yet"}
					</div>
				) : isTimeMachineMode && !editingCardId ? (
					<TimeMachineCarousel
						notes={sortedNotes}
						notesList={notesList}
						relatedNotesData={relatedNotesData}
						pinnedIds={pinnedIds}
						startEditing={startEditing}
						setDeleteDialogNote={setDeleteDialogNote}
						onTogglePin={onTogglePin}
						onAnnotate={onAnnotate}
						setAddLinkNote={setAddLinkNote}
						addLinkedNote={addLinkedNote}
						onSimilarClick={onSimilarClick}
						onOpenReference={(n) => setReferenceViewNote(n)}
						formatTime={formatTime}
						t={t}
					/>
				) : (
					<div className={viewMode === "double" ? "columns-2 gap-2 [&>*]:mb-2 [&>*]:break-inside-avoid" : "space-y-2"}>
					{sortedNotes.map((note) => {
						const isExpanded = expandedCards.has(note.id);
						const contentLines = note.userNotes?.split("\n") ?? [];
						const isLong = contentLines.length > 20;
						const displayContent = isExpanded ? contentLines : contentLines.slice(0, 20);
						const isEditing = editingCardId === note.id;

						return (
						<div key={note.id}>

							{isTimeMachineMode && !isEditing ? (
								<TimeMachineNoteCard
									note={note}
									notesList={notesList}
									relatedNotesData={relatedNotesData}
									pinned={pinnedIds.includes(note.id)}
									variant={
										timeMachineStyleMode === "fixed"
											? timeMachineStyle
											: note.id % 8
									}
									onStartEdit={() => startEditing(note)}
									onDelete={() => setDeleteDialogNote(note)}
									onTogglePin={() => onTogglePin(note.id)}
									onAnnotate={() => onAnnotate?.(note)}
									onOpenLink={() => setAddLinkNote(note)}
									onAddToChat={() => addLinkedNote({ id: note.id, name: note.name, userNotes: note.userNotes, date: note.date, tags: note.tags.map((t) => t.tagName) })}
									onSimilar={() => onSimilarClick?.(note.id)}
									onOpenReference={(n) => setReferenceViewNote(n)}
									formatTime={formatTime}
									t={t}
								/>
							) : (
								<motion.div
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
								style={isEditing ? { borderWidth: 1.5 } : undefined}
								className={"group w-full rounded-xl border px-4 py-3 transition-all duration-200 "
									+ (isEditing
											? "border-foreground/70 bg-card hover:border-foreground"
										: draft.id === note.id
											? "border-primary/30 bg-primary/[0.02] ring-1 ring-primary/10"
											: "border-border/30 bg-card hover:border-border/60 hover:bg-muted/[0.02]")
									+ (pinnedIds.includes(note.id) ? " relative" : "")}
							>
								{isEditing ? (
						// --- Inline edit mode ---
							<div className="space-y-2">
							<input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t("titlePlaceholder")} className="w-full text-sm font-semibold bg-transparent border-b border-border/40 pb-1 focus-visible:outline-none focus-visible:border-primary/40" />
							<DiaryTiptapEditor noteLinkList={noteLinkList?.filter((n) => n.id !== editingCardId)} onLinkNote={onLinkNote ? (id: number) => onLinkNote(id, editingCardId ?? undefined) : undefined} variant="edit" value={editContent} onChange={setEditContent} recentTags={recentTags} placeholder={t("contentPlaceholder")}
								toolbarEnd={
									<>
										<button type="button" onClick={cancelEditing} disabled={isSaving} className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"><X className="w-3.5 h-3.5" />{t("cancel")}</button>
										<button type="button" onClick={handleSaveEdit} disabled={isSaving} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"><Check className="w-3.5 h-3.5" />{isSaving ? t("saving") : t("save")}</button>
									</>
								}
							/>
							{(() => {
								const et = extractTagsFromContent(editContent);
								if (et.length === 0) return null;
								return (
									<div className="flex flex-wrap gap-1 px-0.5 pb-1">
										{et.map((t) => (
											<span key={t} className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/70">
												#{t}
											</span>
										))}
									</div>
								);
							})()}
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
														<span className="truncate">{note.name}</span>
														{note.origin && note.origin !== "manual" && (
															<span className="inline-flex items-center gap-0.5 ml-1 text-[9px] text-muted-foreground/60 shrink-0">
																<CheckSquare className="w-2.5 h-2.5" />
																{t("todoNoteBadge")}
															</span>
														)}
													</div>
												)}
											</div>
											{!isEditing && (
												<>
													<button
														type="button"
											onClick={(e) => { e.stopPropagation(); addLinkedNote({ id: note.id, name: note.name, userNotes: note.userNotes, date: note.date, tags: note.tags.map((t) => t.tagName) }); }}
														title={locale === "zh" ? "添加到对话" : "Add to chat"}
														className={cn("rounded p-1 -mt-1 text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", isMobile && "p-2.5 opacity-100")}
													>
														<MessageCircle className="w-3.5 h-3.5" />
													</button>
													<button
														type="button"
														onClick={(e) => { e.stopPropagation(); setAddLinkNote(note); }}
														title={t("linkNote")}
														className={cn("rounded p-1 -mt-1 text-muted-foreground/30 hover:text-primary hover:bg-primary/10 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", isMobile && "p-2.5 opacity-100")}
													>
														<Link2 className="w-3.5 h-3.5" />
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
													<DropdownMenuItem onClick={() => onSimilarClick?.(note.id)}>
														<GitFork className="w-3.5 h-3.5 mr-2" />
														{t("similarNotes")}
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => setAddLinkNote(note)}>
														<Link2 className="w-3.5 h-3.5 mr-2" />
														链接
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
										{note.relatedTodos && note.relatedTodos.length > 0 && (
											<div className="flex items-center flex-wrap gap-1 mt-2">
												{note.relatedTodos.map((td) => (
													<span
														key={td.id}
														className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60"
													>
														<CheckSquare className="w-2.5 h-2.5" />
														{t("linkedTodo")}{td.name}
													</span>
												))}
											</div>
										)}
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
										{(() => {
											const refIds = note.relatedNoteIds ?? [];
											const outgoingNotes = refIds.map((rid: number) => notesList.find(n => n.id === rid) ?? relatedNotesData?.find(n => n.id === rid)).filter(Boolean);
											const incomingNotes = relatedNotesData?.filter(n => n.relatedNoteIds?.includes(note.id) && n.id !== note.id) ?? [];
											const total = outgoingNotes.length + incomingNotes.length;
											if (total === 0) return null;
											const isExpandable = total >= 3;
											const isOpen = !isExpandable || refsExpanded.has(note.id);
											return (
												<>
													{isExpandable && (
														<button
															type="button"
															onClick={() => setRefsExpanded(prev => { const n = new Set(prev); isOpen ? n.delete(note.id) : n.add(note.id); return n; })}
															className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground/50 hover:text-primary/70 transition-colors"
														>
															{isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
															<span>引用{outgoingNotes.length}条笔记，被{incomingNotes.length}条笔记引用</span>
														</button>
													)}
													{isOpen && outgoingNotes.length > 0 && outgoingNotes.map((ref: any) => (
														<button
															key={ref.id}
															type="button"
															onClick={() => setReferenceViewNote(note)}
															className={cn("flex items-start gap-1.5 mt-1.5 text-[10px] text-muted-foreground/50 hover:text-primary/70 transition-colors w-full text-left", isMobile && "text-xs px-1 py-1")}
														>
															<span className="w-3 h-3 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
																<ArrowUpRight className="w-2 h-2 text-primary/60" />
															</span>
															<span className="text-[10px] text-muted-foreground/40 leading-relaxed line-clamp-1 text-left break-words min-w-0 flex-1">
																{((ref.name ?? "") + " " + (ref.userNotes ?? "").slice(0, 80)).trim()}
															</span>
														</button>
													))}
													{isOpen && incomingNotes.length > 0 && incomingNotes.map((ref: any) => (
														<button
															key={ref.id}
															type="button"
															onClick={() => setReferenceViewNote(note)}
															className={cn("flex items-start gap-1.5 mt-1.5 text-[10px] text-muted-foreground/50 hover:text-primary/70 transition-colors w-full text-left", isMobile && "text-xs px-1 py-1")}
														>
															<span className="w-3 h-3 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
																<ArrowDownLeft className="w-2 h-2 text-primary/60" />
															</span>
															<span className="text-[10px] text-muted-foreground/40 leading-relaxed line-clamp-1 text-left break-words min-w-0 flex-1">
																{((ref.name ?? "") + " " + (ref.userNotes ?? "").slice(0, 80)).trim()}
															</span>
														</button>
													))}
												</>
											);
										})()}
									</>
									)}
									</motion.div>
							)}
						</div>
						);
					})}
					</div>
				)}
				{/* 时光机：底部常驻「再次出发」按钮，纯文字无边框无图标，重新随机穿越；卡片渲染完毕后才显示 */}
			{isTimeMachineMode && !editingCardId && !timeMachinePending && sortedNotes.length > 0 && (
				<div className="sticky bottom-3 z-20 mt-6 flex justify-center pb-1">
					<button
						type="button"
						onClick={onTimeMachineLaunch}
						className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/95 px-4 py-2 text-sm font-medium text-foreground/90 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.18)] backdrop-blur transition-all duration-200 hover:border-primary/40 hover:text-primary active:scale-[0.97]"
					>
						{locale === "zh" ? "再次出发" : "Launch again"}
					</button>
				</div>
			)}
			{hasMore && <div ref={sentinelRef} className="h-2" />}
				{isNotesFetching && notesOffset > 0 && (
					<div className="text-xs text-muted-foreground/40 text-center py-2">加载中...</div>
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

					{referenceViewNote && (
						<ReferenceModal
							isOpen={true}
							onClose={() => setReferenceViewNote(null)}
							note={referenceViewNote}
							noteName={referenceViewNote.name ?? ''}
							allNotes={relatedNotesData ?? []}
						/>
					)}
				{addLinkNote && (
					<AddNoteLinkModal
						isOpen={true}
						onClose={() => setAddLinkNote(null)}
						noteId={addLinkNote.id}
						noteName={addLinkNote.name ?? ""}
					/>
				)}
				</div>
			</div>
		</div>
	);
}
