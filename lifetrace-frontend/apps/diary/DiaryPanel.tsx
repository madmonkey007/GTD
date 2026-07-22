"use client";

import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiaryEditor } from "@/apps/diary/DiaryEditor";
import { DiarySidebar } from "@/apps/diary/components/DiarySidebar";
import { useDiaryStats } from "@/apps/diary/hooks/useDiaryStats";
import {
	formatDateInput,
	getDayRange,
	normalizeDateOnly,
	parseJournalDate,
	resolveBucketRange,
} from "@/apps/diary/journal-utils";
import type {
	JournalAutoLinkRequest,
	JournalCreate,
	JournalGenerateRequest,
} from "@/lib/generated/schemas";
import {
	type JournalView,
	useJournalMutations,
	useJournals,
} from "@/lib/query";
import { useJournalStore } from "@/lib/store/journal-store";
import { usePinStore } from "@/lib/store/pin-store";
import { useLocaleStore } from "@/lib/store/locale";
import type { JournalDraft } from "@/apps/diary/types";
import type { TrashEntry } from "@/apps/diary/hooks/useJournalTrash";
import { useJournalTrash } from "@/apps/diary/hooks/useJournalTrash";
import { DiaryTrashView } from "@/apps/diary/components/DiaryTrashView";
import { DiaryChatPanel } from "@/apps/diary/components/DiaryChatPanel";
import { AnnotationModal } from "@/apps/diary/components/AnnotationModal";
import { CompareNotesModal } from "@/apps/diary/components/CompareNotesModal";

const emptyDraft = (date: Date): JournalDraft => ({
	id: null,
	name: "",
	userNotes: "",
	contentObjective: "",
	contentAi: "",
	mood: "",
	energy: null,
	tags: [],
	relatedTodoIds: [],
	relatedActivityIds: [],
	relatedNoteIds: [],
	date: normalizeDateOnly(date),
});

const extractTagsFromUserNotes = (notes: string): string[] => {
	// 匹配后跟空白符或行尾的完整 #标签
	const matches = notes.match(/#([^\s#]+)(\s|$)/g);
	if (!matches) return [];
	return [...new Set(matches.map((m) => m.slice(1).trimEnd()))];
};

const parseTags = (input: string) =>
	input.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0);

export function DiaryPanel() {
	const t = useTranslations("journalPanel");
	const { locale } = useLocaleStore();
	const [selectedDate, setSelectedDate] = useState(() =>
		normalizeDateOnly(new Date()),
	);
	const [heatmapFilterDate, setHeatmapFilterDate] = useState<Date | null>(null);
		const [similarToNoteId, setSimilarToNoteId] = useState<number | null>(null);
	const [annotateTarget, setAnnotateTarget] = useState<JournalView | null>(null);
	const [compareTarget, setCompareTarget] = useState<{ source: JournalView; current: JournalView } | null>(null);
	const [draft, setDraft] = useState<JournalDraft>(() =>
		emptyDraft(new Date()),
	);
	const [, setTagInput] = useState("");
	const lastSyncKey = useRef<string | null>(null);
	const clearAfterSubmit = useRef(false);
	const initialLoadComplete = useRef(false);
	const {
		refreshMode,
		fixedTime,
		workHoursEnd,
		customTime,
		autoLinkEnabled,
		autoGenerateObjectiveEnabled,
		autoGenerateAiEnabled,
	} = useJournalStore();

	// Responsive layout
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
	const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerWidth(entry.contentRect.width);
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Derived state: when container is wide enough, show sidebars inline
	// left=288px + right=280px(min) + gaps=8px + middle needs ~400px min
	// So at containerWidth >= ~976, all 3 panels can fit
	const showLeftInline = containerWidth >= 1000 || containerWidth === 0;
	const showRightInline = containerWidth >= 900 || containerWidth === 0;
	const [showTrash, setShowTrash] = useState(false);
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const { stats, filterMode, setFilterMode } = useDiaryStats();
		const { addToTrash, trashEntries, clearTrash, restoreFromTrash } = useJournalTrash();
	const { pinnedIds, toggle: togglePin } = usePinStore();
	const dayRange = useMemo(() => getDayRange(selectedDate), [selectedDate]);
	const bucket = useMemo(
		() =>
			resolveBucketRange(
				new Date(
					selectedDate.getFullYear(),
					selectedDate.getMonth(),
					selectedDate.getDate(),
					12,
					0,
					0,
					0,
				),
				refreshMode,
				fixedTime,
				workHoursEnd,
				customTime,
			),
		[selectedDate, refreshMode, fixedTime, workHoursEnd, customTime],
	);
	const {
		data: journalResponse,
		isLoading: isJournalLoading,
		error: journalError,
		refetch,
	} = useJournals({
		limit: 1,
		offset: 0,
		startDate: dayRange.start.toISOString(),
		endDate: dayRange.end.toISOString(),
	});
	const activeJournal = useMemo(
		() => journalResponse?.journals?.[0] ?? null,
		[journalResponse?.journals],
	);

	// Load all notes for the AI chat panel
	const { data: allNotesData, refetch: refetchAllNotes } = useJournals({ limit: 500, offset: 0 });

	// 按最近使用排序的标签列表（用于自动补全）
	const [cachedRecentTags, setCachedRecentTags] = useState<string[]>([]);
	const recentTags = cachedRecentTags;
	useEffect(() => {
		if (!allNotesData?.journals) return;
		const tagDateMap = new Map<string, string>();
		for (const journal of allNotesData.journals) {
			for (const tag of journal.tags ?? []) {
				const existing = tagDateMap.get(tag.tagName);
				if (!existing || journal.createdAt > existing) {
					tagDateMap.set(tag.tagName, journal.createdAt);
				}
			}
		}
		setCachedRecentTags(
			[...tagDateMap.entries()]
				.sort((a, b) => b[1].localeCompare(a[1]))
				.map(([tag]) => tag)
		);
	}, [allNotesData]);
	const noteContent = useMemo(() => {
		const notes = allNotesData?.journals ?? [];
		return notes
			.map((n) => [n.name, n.userNotes].filter(Boolean).join("\n"))
			.filter(Boolean)
			.join("\n\n---\n\n");
	}, [allNotesData]);

	const {
		createJournal,
		updateJournal,
		autoLinkJournal,
		generateObjective,
		generateAiView,
		deleteJournal,
		isCreating,
		isUpdating,
		} = useJournalMutations();
	const syncDraftFromJournal = useCallback(
		(journal: JournalView) => {
			const journalDate = parseJournalDate(journal.date);
			setDraft({
				id: journal.id,
				name: journal.name ?? "",
				userNotes: journal.userNotes ?? "",
				contentObjective: journal.contentObjective ?? "",
				contentAi: journal.contentAi ?? "",
				mood: journal.mood ?? "",
				energy: journal.energy ?? null,
				tags: (journal.tags ?? []).map((tag) => tag.tagName),
				relatedTodoIds: journal.relatedTodoIds ?? [],
				relatedActivityIds: journal.relatedActivityIds ?? [],
				relatedNoteIds: journal.relatedNoteIds ?? [],
				date: journalDate,
			});
			setSelectedDate(journalDate);
			setTagInput((journal.tags ?? []).map((tag) => tag.tagName).join(", "));
		},
		[],
	);
	useEffect(() => {
		if (!initialLoadComplete.current) {
			// Skip sync until initial data load finishes — editor stays empty on mount/remount.
			// After loading completes, clear draft and lock initialLoadComplete so
			// subsequent activeJournal updates (date changes, auto-save) sync normally.
			if (isJournalLoading) return;
			initialLoadComplete.current = true;
			setDraft(emptyDraft(selectedDate));
			setTagInput("");
			lastSyncKey.current = `${bucket.bucketStart.toISOString()}-${activeJournal?.id ?? "new"}`;
			return;
		}
		if (isJournalLoading) return;
		const syncKey = `${bucket.bucketStart.toISOString()}-${activeJournal?.id ?? "new"}`;
		if (lastSyncKey.current === syncKey) return;

		lastSyncKey.current = syncKey;

		if (clearAfterSubmit.current) {
			clearAfterSubmit.current = false;
			return;
		}

		if (activeJournal) {
			const activeDate = parseJournalDate(activeJournal.date);
			const activeTime = activeDate.getTime();
			if (
				activeTime >= dayRange.start.getTime() &&
				activeTime <= dayRange.end.getTime()
			) {
				syncDraftFromJournal(activeJournal);
				return;
			}
		}

		setDraft(emptyDraft(selectedDate));
		setTagInput("");
	}, [
		activeJournal,
		bucket.bucketStart,
		dayRange,
		isJournalLoading,
		selectedDate,
		syncDraftFromJournal,
	]);


const handleDeleteJournal = async (note: TrashEntry) => {
	try {
		addToTrash({
			id: note.id,
			name: note.name,
			userNotes: note.userNotes,
			date: note.date,
			tags: note.tags,
			mood: note.mood,
			energy: note.energy,
			contentObjective: note.contentObjective,
			contentAi: note.contentAi,
		});
		await deleteJournal(note.id);
		clearAfterSubmit.current = true;
	} catch (_error) {
		// error handled by mutation
	}
};
const handleTogglePin = (journalId: number) => {
	togglePin(journalId);
};
const handleRestore = async (entry: TrashEntry) => {
	try {
		const tags = (entry.tags ?? []).map((t) => t.tagName);
		await createJournal({
			name: entry.name || undefined,
			user_notes: entry.userNotes,
			date: entry.date,
			content_format: "markdown",
			content_objective: entry.contentObjective || null,
			content_ai: entry.contentAi || null,
			mood: entry.mood || null,
			energy: entry.energy ?? null,
			tags: tags.length > 0 ? tags : undefined,
		});
	} catch (_error) {
		// error handled by mutation
	}
};
const handleSaveCardEdit = async (
	journalId: number,
	data: { name?: string | null; user_notes?: string | null },
) => {
	const tags = data.user_notes ? extractTagsFromUserNotes(data.user_notes) : [];
	await updateJournal(journalId, {
		name: data.name ?? null,
		user_notes: data.user_notes ?? null,
		tags: tags.length > 0 ? tags : null,
	});
};

	const buildSavePayload = (
		updatedDraft: JournalDraft,
		tags: string[],
	): JournalCreate => ({
		name: updatedDraft.name || undefined,
		user_notes: updatedDraft.userNotes,
		date: updatedDraft.id ? formatDateInput(updatedDraft.date) : formatDateInput(new Date()),
		content_format: "markdown",
		content_objective: updatedDraft.contentObjective || null,
		content_ai: updatedDraft.contentAi || null,
		mood: updatedDraft.mood || null,
		energy: updatedDraft.energy,
		day_bucket_start: updatedDraft.id
			? bucket.bucketStart.toISOString()
			: resolveBucketRange(new Date(), refreshMode, fixedTime, workHoursEnd, customTime).bucketStart.toISOString(),
		tags,
		related_todo_ids: updatedDraft.relatedTodoIds,
		related_activity_ids: updatedDraft.relatedActivityIds,
		related_note_ids: updatedDraft.relatedNoteIds,
	});
	const runAutoLink = async (
		journalId: number,
		snapshot?: { title: string; content: string; date: Date },
	) => {
		const payload: JournalAutoLinkRequest = {
			journal_id: journalId,
			title: snapshot?.title ?? draft.name,
			content_original: snapshot?.content ?? draft.userNotes,
			date: formatDateInput(snapshot?.date ?? draft.date),
			day_bucket_start: bucket.bucketStart.toISOString(),
			max_items: 3,
		};
		const result = await autoLinkJournal(payload);
		setDraft((prev) => ({
			...prev,
			relatedTodoIds: result.relatedTodoIds,
			relatedActivityIds: result.relatedActivityIds,
		}));
	};
	const runObjectiveGeneration = async (
		journalId: number,
		snapshot?: { title: string; content: string; date: Date },
	) => {
		const payload: JournalGenerateRequest = {
			journal_id: journalId,
			title: snapshot?.title ?? draft.name,
			content_original: snapshot?.content ?? draft.userNotes,
			date: formatDateInput(snapshot?.date ?? draft.date),
			day_bucket_start: bucket.bucketStart.toISOString(),
			language: locale,
		};
		const result = await generateObjective(payload);
		setDraft((prev) => ({ ...prev, contentObjective: result.content }));
	};
	const runAiGeneration = async (
		journalId: number,
		snapshot?: { title: string; content: string; date: Date },
	) => {
		const payload: JournalGenerateRequest = {
			journal_id: journalId,
			title: snapshot?.title ?? draft.name,
			content_original: snapshot?.content ?? draft.userNotes,
			date: formatDateInput(snapshot?.date ?? draft.date),
			day_bucket_start: bucket.bucketStart.toISOString(),
			language: locale,
		};
		const result = await generateAiView(payload);
		setDraft((prev) => ({ ...prev, contentAi: result.content }));
	};
	const handleSave = async (options?: {
		tagsOverride?: string[];
		draftOverride?: Partial<JournalDraft>;
	}) => {
		// 先合并 draft 与 override，确保从最终内容中提取标签
		const updatedDraft = { ...draft, ...options?.draftOverride };
		const tags = options?.tagsOverride ?? extractTagsFromUserNotes(updatedDraft.userNotes);
		updatedDraft.tags = tags;
		setDraft(updatedDraft);
		setTagInput(tags.join(", "));
		const payload = buildSavePayload(updatedDraft, tags);

		let saved = null;
		try {
			if (updatedDraft.id) {
				const { uid: _uid, ...updatePayload } = payload;
				saved = await updateJournal(updatedDraft.id, updatePayload);
			} else {
				saved = await createJournal(payload);
			}
		} catch (_error) {
			return;
		}

		if (!saved) return;

		const savedDate = parseJournalDate(saved.date);
		setDraft({
			id: saved.id,
			name: saved.name ?? "",
			userNotes: saved.userNotes ?? "",
			contentObjective: saved.contentObjective ?? "",
			contentAi: saved.contentAi ?? "",
			mood: saved.mood ?? "",
			energy: saved.energy ?? null,
			tags: (saved.tags ?? []).map((tag) => tag.tagName),
			relatedTodoIds: saved.relatedTodoIds ?? [],
			relatedActivityIds: saved.relatedActivityIds ?? [],
			relatedNoteIds: saved.relatedNoteIds ?? [],
			date: savedDate,
		});
		setSelectedDate(savedDate);
		setTagInput((saved.tags ?? []).map((tag) => tag.tagName).join(", "));

		const snapshot = {
			title: saved.name ?? "",
			content: saved.userNotes ?? "",
			date: savedDate,
		};

		// LLM 后台生成（autoLink / 客观记录 / AI视角），不阻塞主流程
		// 笔记已创建并刷新列表，这些增强在后台完成后各自 invalidate 更新
		const llmTasks: Promise<void>[] = [];
		if (autoLinkEnabled) {
			llmTasks.push(
				runAutoLink(saved.id, snapshot).catch(() => {}),
			);
		}
		if (autoGenerateObjectiveEnabled && !saved.contentObjective) {
			llmTasks.push(
				runObjectiveGeneration(saved.id, snapshot).catch(() => {}),
			);
		}
		if (autoGenerateAiEnabled && !saved.contentAi) {
			llmTasks.push(
				runAiGeneration(saved.id, snapshot).catch(() => {}),
			);
		}
		// 不 await：后台并发执行，完成后再触发各自 invalidate 更新 UI
		void Promise.all(llmTasks);
	};
	const handleAutoSave = (options?: {
		tagValue?: string;
		draftOverride?: Partial<JournalDraft>;
	}) => {
		if (isCreating || isUpdating) return;
		const tags =
			options?.tagValue !== undefined
				? parseTags(options.tagValue)
				: (options?.draftOverride?.userNotes !== undefined
					? extractTagsFromUserNotes(options.draftOverride.userNotes)
					: extractTagsFromUserNotes(draft.userNotes));
		const draftSnapshot = { ...draft, ...options?.draftOverride, tags };
		const hasContent =
			draftSnapshot.userNotes.trim().length > 0 ||
			tags.length > 0 ||
			(draftSnapshot.contentObjective ?? "").trim().length > 0 ||
			(draftSnapshot.contentAi ?? "").trim().length > 0;

		// 新笔记（无 id）不触发自动保存，避免输入时就在列表中生成草稿记录；
		// 只有点击发送（handleSubmitNotes）才会创建。已有 id 的笔记保留失焦自动保存。
		if (!draftSnapshot.id) return;
		if (!hasContent) return;
		void handleSave({
			tagsOverride: tags,
			draftOverride: options?.draftOverride,
		});
	};

	const handleInlineTag = useCallback((tagName: string) => {
		setDraft((prev) => {
			if (prev.tags.includes(tagName)) return prev;
			return { ...prev, tags: [...prev.tags, tagName] };
		});
		setTagInput((prev) => {
			const existing = prev ? prev.split(",").map(t => t.trim()).filter(Boolean) : [];
			if (existing.includes(tagName)) return prev;
			return [...existing, tagName].join(", ");
		});
	}, []);

	const handleAnnotate = async (content: string) => {
		if (!annotateTarget) return;
		try {
			const now = new Date();
			const y = now.getFullYear();
			const mo = String(now.getMonth() + 1).padStart(2, '0');
			const d = String(now.getDate()).padStart(2, '0');
			const h = String(now.getHours()).padStart(2, '0');
			const mi = String(now.getMinutes()).padStart(2, '0');
			const result = await createJournal({
				name: `${y}-${mo}-${d} ${h}:${mi}`,
				user_notes: content,
				date: formatDateInput(now),
				content_format: "markdown",
				related_note_ids: [annotateTarget.id],
			});
				if (result) {
					setAnnotateTarget(null);
					clearAfterSubmit.current = true;
					refetch();
					refetchAllNotes();
			}
		} catch (err) {
			console.error("[annotate] create failed:", err);
		}
	};

	const handleSubmitNotes = async () => {
		if (!draft.userNotes.trim()) return;
		await handleSave();
		setDraft((prev) => ({ ...prev, id: null, userNotes: "", name: "" }));
		clearAfterSubmit.current = true;
	};

	if (journalError) {
		const errorMessage =
			journalError instanceof Error
				? journalError.message
				: String(journalError);
		const statusCode = errorMessage.includes("503") ? 503 : null;
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
				className="flex h-full flex-col overflow-hidden bg-background">
				<div className="flex flex-1 items-center justify-center">
					<div className="flex flex-col items-center gap-5 text-center max-w-sm">
						<div className="w-12 h-12 rounded-2xl bg-destructive/8 flex items-center justify-center ring-1 ring-destructive/15">
							<AlertCircle className="w-6 h-6 text-destructive/60" />
						</div>
						<div className="space-y-1.5">
							<p className="text-sm font-semibold text-foreground">{t("loadFailedTitle")}</p>
							<p className="text-xs text-muted-foreground/70 leading-relaxed">
								{t("loadFailedDescription")}
							</p>
							{statusCode === 503 && (
								<p className="text-xs text-destructive/50 mt-1">{t("error503")}</p>
							)}
						</div>
						<button
							onClick={() => refetch()}
							className="rounded-lg bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors active:scale-[0.97]"
						>
							{t("retry")}
						</button>
					</div>
				</div>
			</motion.div>
		);
	}


	// 聊天工具改动了笔记：若正是当前打开的笔记，重新拉取并只同步标签（不触碰正文/标题，避免覆盖编辑中内容）
	const handleNoteMutated = useCallback(async (noteId: number) => {
		// AI 创建/修改了笔记，但该笔记不是当前编辑中的笔记
		// → 阻止 sync 将新笔记内容加载到编辑器 draft 中
		if (activeJournal?.id !== noteId) {
			clearAfterSubmit.current = true;
			return;
		}
		const res = await refetch();
		const j = res.data?.journals?.[0];
		if (!j || j.id !== noteId) return;
		const tags = (j.tags ?? []).map((t) => t.tagName);
		setDraft((prev) => ({ ...prev, tags }));
		setTagInput(tags.join(", "));
	}, [activeJournal?.id, refetch]);

		return ( <>
			<div className="flex h-full flex-col overflow-hidden bg-gray-100/60 dark:bg-zinc-900/20">
			<div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden justify-center gap-1 px-2 relative">

					
				{/* Left sidebar — inline when wide, otherwise hidden (drawer overlay) */}
				{showLeftInline && <DiarySidebar stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} onFilterModeChange={(mode) => { setShowTrash(false); setSelectedTag(null); setFilterMode(mode); if (mode === "all") setHeatmapFilterDate(null); }} onRestore={handleRestore} onSelectDate={(date) => { setShowTrash(false); setSelectedTag(null); setHeatmapFilterDate(date); setFilterMode("all"); }}  onShowTrash={() => setShowTrash(true)} selectedTag={selectedTag} onSelectTag={(tag) => { setShowTrash(false); setSelectedTag(tag); if (tag) { setFilterMode("all"); } }} />}
				<div className="flex-1 min-w-0 max-w-[800px] flex flex-col">
					{showTrash ? (
						<DiaryTrashView
							trashEntries={trashEntries}
							onRestore={(entry) => {
								const restored = restoreFromTrash(entry.id);
								if (restored) {
									handleRestore(restored);
									setShowTrash(false);
								}
							}}
							onClearTrash={clearTrash}
						/>
					) : (
						<>
						<DiaryEditor
							draft={draft}
								filterMode={filterMode}
									tagFilter={selectedTag}
								heatmapFilterDate={heatmapFilterDate}
								onClearHeatmapFilter={() => setHeatmapFilterDate(null)}
								pinnedIds={pinnedIds}
								onDelete={handleDeleteJournal}
								onTogglePin={handleTogglePin}
								onSaveCardEdit={handleSaveCardEdit}
							similarToNoteId={similarToNoteId}
							onSimilarClick={(id) => setSimilarToNoteId(id)}
							onClearSimilarFilter={() => setSimilarToNoteId(null)}
							recentTags={recentTags}
							onAnnotate={(note) => setAnnotateTarget(note)}
							onCompareNotes={(source, current) => setCompareTarget({ source, current })}
							relatedNotesData={allNotesData?.journals ?? []}
							onTitleChange={(value) =>
								setDraft((prev) => ({ ...prev, name: value }))
							}
							onUserNotesChange={(value) =>
								setDraft((prev) => ({ ...prev, userNotes: value }))
							}
							onUserNotesBlur={(value) =>
								handleAutoSave({ draftOverride: { userNotes: value } })
							}
							onSubmit={handleSubmitNotes}
							onInlineTag={handleInlineTag}
							showLeftToggle={!showLeftInline}
							showRightToggle={!showRightInline}
							isLeftOpen={leftDrawerOpen}
							isRightOpen={rightDrawerOpen}
							onToggleLeft={() => setLeftDrawerOpen(prev => !prev)}
							onToggleRight={() => setRightDrawerOpen(prev => !prev)}
						/>
						</>
					)}

				</div>

		{/* Right-side chat panel for AI analysis — inline when wide, otherwise hidden (drawer overlay) */}
		{showRightInline && (
			<div className="w-[380px] flex-shrink min-w-[280px] flex flex-col rounded-(--radius) bg-[oklch(var(--card))] shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_3px_0_rgba(0,0,0,0.06)] overflow-hidden">
				<DiaryChatPanel noteContent={noteContent} currentJournalId={activeJournal?.id ?? null} onNoteMutated={handleNoteMutated} />
			</div>
		)}

		{/* Left drawer overlay */}
		<AnimatePresence>
			{!showLeftInline && leftDrawerOpen && (
				<>
					<motion.div
						key="left-drawer-backdrop"
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
						className="fixed inset-0 z-30 bg-black/30" onClick={() => setLeftDrawerOpen(false)}
					/>
					<motion.div
						key="left-drawer"
						initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
						transition={{ type: "spring", damping: 30, stiffness: 300 }}
						className="absolute left-0 top-0 z-40 h-full w-72 shadow-xl"
					>
						<DiarySidebar stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} onFilterModeChange={(mode) => { setShowTrash(false); setSelectedTag(null); setFilterMode(mode); if (mode === "all") setHeatmapFilterDate(null); }} onRestore={handleRestore} onSelectDate={(date) => { setShowTrash(false); setSelectedTag(null); setHeatmapFilterDate(date); setFilterMode("all"); }}  onShowTrash={() => setShowTrash(true)} selectedTag={selectedTag} onSelectTag={(tag) => { setShowTrash(false); setSelectedTag(tag); if (tag) { setFilterMode("all"); } }} />
					</motion.div>
				</>
			)}
		</AnimatePresence>

		{/* Right drawer overlay */}
		<AnimatePresence>
			{!showRightInline && rightDrawerOpen && (
				<>
					<motion.div
						key="right-drawer-backdrop"
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
						className="fixed inset-0 z-30 bg-black/30" onClick={() => setRightDrawerOpen(false)}
					/>
					<motion.div
						key="right-drawer"
						initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
						transition={{ type: "spring", damping: 30, stiffness: 300 }}
						className="absolute right-0 top-0 z-40 h-full w-[380px] shadow-xl"
					>
						<DiaryChatPanel noteContent={noteContent} showBackButton onClose={() => setRightDrawerOpen(false)} onNoteMutated={handleNoteMutated} />
					</motion.div>
				</>
			)}
		</AnimatePresence>
		</div>
	</div>
			{annotateTarget && <AnnotationModal
				isOpen={true}
				onClose={() => setAnnotateTarget(null)}
				sourceNote={annotateTarget}
				onSubmit={handleAnnotate}
				recentTags={recentTags}
			/>}
			{compareTarget && <CompareNotesModal
				isOpen={true}
				onClose={() => setCompareTarget(null)}
				sourceNote={compareTarget.source}
				currentNote={compareTarget.current}
			/>}
		</>
		);
}
