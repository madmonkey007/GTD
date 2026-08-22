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
	useJournalLites,
	useJournalMutations,
	useJournals,
	useProjectMutations,
} from "@/lib/query";
import { useNoteLinkMutations } from "@/lib/query/note-links";
import { useJournalStore } from "@/lib/store/journal-store";
import { useFocusTarget } from "@/lib/store/focus-target-store";
import { usePinStore } from "@/lib/store/pin-store";
import { useLocaleStore } from "@/lib/store/locale";
import { cn } from "@/lib/utils";
import type { JournalDraft } from "@/apps/diary/types";
import type { TrashEntry } from "@/apps/diary/hooks/useJournalTrash";
import { useJournalTrash } from "@/apps/diary/hooks/useJournalTrash";
import { DiaryTrashView } from "@/apps/diary/components/DiaryTrashView";
import { DiaryChatPanel } from "@/apps/diary/components/DiaryChatPanel";
import { AnnotationModal } from "@/apps/diary/components/AnnotationModal";
import { CompareNotesModal } from "@/apps/diary/components/CompareNotesModal";
import { CollectionDetail } from "@/apps/diary/components/CollectionDetail";
import { CollectionGallery } from "@/apps/diary/components/CollectionGallery";
import { ProjectHeader } from "@/apps/project/ProjectHeader";
import { ProjectNoteManager } from "@/apps/project/ProjectNoteManager";
import { ProjectArchiveView } from "@/apps/project/ProjectArchiveView";
import { useArchivedProjects, useProject } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { useMobileToolbarStore } from "@/lib/store/mobile-toolbar-store";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useDiaryPanelResize } from "@/lib/hooks/useDiaryPanelResize";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
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
	const isMobile = useIsMobile();
	const { locale } = useLocaleStore();
	const [selectedDate, setSelectedDate] = useState(() =>
		normalizeDateOnly(new Date()),
	);
	const [heatmapFilterDate, setHeatmapFilterDate] = useState<Date | null>(null);
	// 时光机：pending 为动画展示中的目标日期（不触发数据加载），
	// timeMachineDate 为动画落定后才 commit 的真实筛选日期（优先于 heatmapFilterDate）
	const [pendingTimeMachineDate, setPendingTimeMachineDate] = useState<Date | null>(null);
	const [timeMachineDate, setTimeMachineDate] = useState<Date | null>(null);
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
	// 本次挂载已由外部（agent 创建/修改笔记、思维分析工具等）触发过一次 journals 刷新。
	// 重挂载后 stale 缓存 refetch 会改变 activeJournal，若放行 sync 会把当天第一条笔记
	// 自动回填进编辑器。对非用户主动（日期切换/手动选中/点击「查看」）的数据变化一律跳过 sync。
	const skipExternalSync = useRef(false);
	// 最近一次同步时的 bucket，用于区分「用户切换日期」与「同一天外部刷新」
	const lastBucketRef = useRef<string | null>(null);
	const [pendingLinks, setPendingLinks] = useState<{ id: number; name: string }[]>([]);
	// 提交成功后自增，通知 DiaryEditor 重置分页到第一页（否则滚动加载后新建的笔记不显示）
	const [notesResetSignal, setNotesResetSignal] = useState(0);
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
	const {
		diaryLeftOpen: leftDrawerOpen,
		setDiaryLeftOpen: setLeftDrawerOpen,
		diaryRightOpen: rightDrawerOpen,
		setDiaryRightOpen: setRightDrawerOpen,
	} = useMobileToolbarStore();
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
	const showLeftInline = !isMobile && (containerWidth >= 1000 || containerWidth === 0);
	const showRightInline = !isMobile && (containerWidth >= 900 || containerWidth === 0);
	// 桌面首次进入笔记面板时默认展开对话面板（用户可通过右上角关闭/搜索栏开关再控制）
	const rightDefaultAppliedRef = useRef(false);
	useEffect(() => {
		if (isMobile || rightDefaultAppliedRef.current) return;
		rightDefaultAppliedRef.current = true;
		if (!rightDrawerOpen) setRightDrawerOpen(true);
	}, [isMobile, rightDrawerOpen, setRightDrawerOpen]);
	const {
		leftWidth,
		rightWidth,
		isDraggingLeft,
		isDraggingRight,
		handleLeftResizePointerDown,
		handleRightResizePointerDown,
	} = useDiaryPanelResize();
	const [showTrash, setShowTrash] = useState(false);
	// 项目归档视图：侧边栏「项目归档」入口打开，主区列出已归档项目
	const [showArchivedProjects, setShowArchivedProjects] = useState(false);
	const { data: archivedProjects = [] } = useArchivedProjects();
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	// 集合视图：none=正常笔记编辑；gallery=集合画廊；detail=单个集合详情
	const [collectionView, setCollectionView] = useState<"none" | "gallery" | "detail">("none");
	const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
	// 项目视图：日记侧不渲染三栏 panelC，项目详情内联在主区展示（与待办侧共享同一实体）
	const [projectViewOpen, setProjectViewOpen] = useState(false);
	const storeSelectedProjectId = useUiStore((s) => s.selectedProjectId);
	const tProject = useTranslations("project");
	const [projectNoteManagerOpen, setProjectNoteManagerOpen] = useState(false);
	const { data: project } = useProject(storeSelectedProjectId);

	const openProjectView = useCallback(() => {
		setShowTrash(false);
		setShowArchivedProjects(false);
		setSelectedTag(null);
		setCollectionView("none");
		setProjectViewOpen(true);
	}, []);
	// 关闭项目视图并清除选中项目，避免侧栏项目入口残留高亮（与筛选/日期/标签互斥）
	const clearProjectView = useCallback(() => {
		setProjectViewOpen(false);
		useUiStore.setState({ selectedProjectId: null });
	}, []);
	const closeProjectView = clearProjectView;

	const selectCollection = useCallback((id: number) => {
		clearProjectView();
		setSelectedCollectionId(id);
		setCollectionView("detail");
	}, []);

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
	// 轻量全量笔记（无 N+1，服务端一次扫描）：时光机/标签补全/聊天上下文共用
	const { data: liteNotesData } = useJournalLites({ limit: 1000, offset: 0 });

	// 重全量列表（含关联/标签序列化，服务端成本高）：延迟加载，
	// 不参与首屏竞争；仅供笔记引用/关联编辑等需要完整字段的场景使用
	const [allNotesEnabled, setAllNotesEnabled] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setAllNotesEnabled(true), 800);
		return () => clearTimeout(timer);
	}, []);
	const { data: allNotesData, refetch: refetchAllNotes } = useJournals({
		limit: 500,
		offset: 0,
		enabled: allNotesEnabled,
	});

	// 时光机：从所有笔记的日期里随机抽取一天（排除今天），先进入动画展示，
	// 动画落定后才 commit 为真实筛选日期触发数据加载
	const handleTimeMachine = useCallback(() => {
		const journals = liteNotesData?.notes ?? [];
		const todayKey = formatDateInput(new Date());
		// 收集“有笔记且非今天”的唯一日期
		const keys = new Set<string>();
		const dateByKey = new Map<string, Date>();
		for (const j of journals) {
			const d = parseJournalDate(j.date);
			const key = formatDateInput(d);
			if (key === todayKey) continue;
			if (!keys.has(key)) {
				keys.add(key);
				dateByKey.set(key, d);
			}
		}
		if (keys.size === 0) return; // 没有历史笔记
		const pool = [...keys];
		const picked = pool[Math.floor(Math.random() * pool.length)];
		setShowTrash(false);
		setShowArchivedProjects(false);
		setSelectedTag(null);
		setCollectionView("none");
		clearProjectView();
		setHeatmapFilterDate(null);
		setFilterMode("all");
		// 先清空已 commit 的日期，再设 pending：动画期间不显示旧笔记
		setTimeMachineDate(null);
		setPendingTimeMachineDate(dateByKey.get(picked) ?? null);
	}, [liteNotesData, clearProjectView, setFilterMode]);
	// 动画落定：把 pending 日期 commit 为真实筛选日期，触发该日笔记加载
	// 动画落定：把 pending 日期 commit 为真实筛选日期，触发该日笔记加载；
	// 同时清空 pending，解除 DiaryEditor 中「动画期间隐藏内容」的拦截
	const commitTimeMachine = useCallback(() => {
		setPendingTimeMachineDate((pending) => {
			if (pending) setTimeMachineDate(pending);
			return null;
		});
	}, []);
	const clearTimeMachine = useCallback(() => {
		setTimeMachineDate(null);
		setPendingTimeMachineDate(null);
	}, []);

	// 按最近使用排序的标签列表（用于自动补全）——标签从轻量数据的正文提取
	const [cachedRecentTags, setCachedRecentTags] = useState<string[]>([]);
	const recentTags = cachedRecentTags;
	useEffect(() => {
		if (!liteNotesData?.notes) return;
		const tagDateMap = new Map<string, string>();
		for (const note of liteNotesData.notes) {
			for (const tag of extractTagsFromUserNotes(note.userNotes ?? "")) {
				const existing = tagDateMap.get(tag);
				if (!existing || note.createdAt > existing) {
					tagDateMap.set(tag, note.createdAt);
				}
			}
		}
		setCachedRecentTags(
			[...tagDateMap.entries()]
				.sort((a, b) => b[1].localeCompare(a[1]))
				.map(([tag]) => tag)
		);
	}, [liteNotesData]);
	const noteContent = useMemo(() => {
		const notes = liteNotesData?.notes ?? [];
		return notes
			.map((n) => [n.name, n.userNotes].filter(Boolean).join("\n"))
			.filter(Boolean)
			.join("\n\n---\n\n");
	}, [liteNotesData]);
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
	const { createNoteLinkAsync } = useNoteLinkMutations();
	const { addNotesAsync } = useProjectMutations();
	const noteLinkList = useMemo(() => {
		if (!allNotesData?.journals) return [];
		return allNotesData.journals
			.filter((n: any) => n.id !== draft.id)
			.map((n: any) => ({
				id: n.id,
				name: n.name ?? '',
				preview: (n.userNotes ?? '').replace(/[\r\n]/g, ' ').slice(0, 80),
				tags: (n.tags ?? []).map((t: any) => t.tagName),
				createdAt: n.createdAt,
			}));
	}, [allNotesData, draft.id]);
	// 稳定 filterJournalIds 的数组引用：project.notes 在 query 缓存中引用稳定，
	// 仅在笔记成员真正变化时才重算，避免父组件每次按键渲染都产生新数组触发 DiaryEditor 清空列表。
	const projectFilterJournalIds = useMemo(
		() => project?.notes?.map((n) => n.id),
		[project?.notes],
	);

	// 使用 NoteLink API 创建 SUPPORTS 链接（替代原先的 related_note_ids 写入）
	// sourceId 可选：编辑态卡片用 editingCardId；新建态无 id 时先保存再建链
	const handleSaveRef = useRef<(opts?: { draftOverride?: Partial<JournalDraft> }) => Promise<JournalView | null>>(async () => null);
	const handleLinkNote = useCallback(async (targetId: number, sourceId?: number) => {
		// 编辑态/已保存草稿：直接创建 SUPPORTS 链接
		const sid = sourceId ?? draft.id;
		if (sid) {
			try {
				await createNoteLinkAsync({
					sourceNoteId: sid,
					input: { targetNoteId: targetId, relationType: "SUPPORTS" },
				});
				refetchAllNotes();
			} catch (e) {
				console.error('Failed to link note:', e);
			}
			return;
		}
		// 新建草稿（尚无 id）：先记为待处理链接，提交保存后再落库
		setPendingLinks((prev) => {
			if (prev.some((pl) => pl.id === targetId)) return prev;
			const target = noteLinkList.find((n) => n.id === targetId);
			return [...prev, { id: targetId, name: target?.name ?? "" }];
		});
	}, [draft.id, noteLinkList, createNoteLinkAsync, refetchAllNotes]);
	const handleRemoveLink = useCallback((targetId: number) => {
		// 仅移除尚未落库的待处理链接；已保存链接的删除在 ReferenceModal 中处理
		setPendingLinks((prev) => prev.filter((pl) => pl.id !== targetId));
	}, []);
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
				date: journalDate,
			});
			setSelectedDate(journalDate);
			setTagInput((journal.tags ?? []).map((tag) => tag.tagName).join(", "));
		},
		[],
	);
	useEffect(() => {
		if (initialLoadComplete.current) {
			if (isJournalLoading) return;
			const syncKey = `${bucket.bucketStart.toISOString()}-${activeJournal?.id ?? "new"}`;
			if (lastSyncKey.current === syncKey) return;
			lastSyncKey.current = syncKey;
			// 用户切换日期（bucket 变化）：正常同步，同时复位外部刷新守卫
			if (lastBucketRef.current !== bucket.bucketStart.toISOString()) {
				lastBucketRef.current = bucket.bucketStart.toISOString();
				skipExternalSync.current = false;
			} else if (skipExternalSync.current) {
				// 同一天内 activeJournal 变化且未复位守卫：判定为外部数据刷新
				// （agent / 思维分析改动笔记后 invalidate 触发的 refetch），
				// 跳过本次自动回填，避免第一条笔记被选中且内容被替换进编辑器
				skipExternalSync.current = false;
				return;
			}
		} else {
			// 首次挂载（含从其他面板切回）：仅等待数据加载完成并锁定初始同步键，不回填编辑器。
			// 编辑器初始为空；用户主动切换日期 / 选中笔记 / 点击「查看」后按正常逻辑同步。
			if (isJournalLoading) return;
			initialLoadComplete.current = true;
			lastBucketRef.current = bucket.bucketStart.toISOString();
			// 记录挂载时已存在的数据键；当 activeJournal 因外部刷新而改变时，
			// 第二分支靠 skipExternalSync 拦截，避免将第一条笔记自动回填进编辑器
			lastSyncKey.current = `${bucket.bucketStart.toISOString()}-${activeJournal?.id ?? "new"}`;
			// 标记本次挂载可能存在外部数据刷新（agent 创建笔记会 invalidate journals 缓存），
			// 同 bucket 下首次出现 activeJournal 变化时跳过，阻止自动回填
			skipExternalSync.current = true;
			return;
		}
		setPendingLinks([]);
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

	// 从 agent 卡片「查看」跳转过来时，打开对应笔记
	const focusTarget = useFocusTarget((s) => s.target);
	const clearFocusTarget = useFocusTarget((s) => s.setTarget);
	useEffect(() => {
		if (!focusTarget || focusTarget.feature !== "note") return;
		const journals = allNotesData?.journals ?? [];
		const found = journals.find((n: any) => String(n.id) === focusTarget.id);
		if (found) {
			syncDraftFromJournal(found as JournalView);
			clearFocusTarget(null);
		}
	}, [focusTarget, allNotesData, syncDraftFromJournal, clearFocusTarget]);


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
		// 删除的正是当前打开/编辑的笔记：清空草稿，避免编辑器残留已删除内容
		if (draft.id === note.id) {
			setNotesResetSignal((v) => v + 1);
			setDraft((prev) => ({ ...prev, id: null, userNotes: "", name: "" }));
		}
		// 列表/统计已由 deleteMutation 本地移除缓存即时刷新，无需全量 refetch
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
				// 项目视图下新建的笔记自动加入当前项目，使其出现在项目笔记列表
				if (saved && projectViewOpen && project) {
					try {
						await addNotesAsync({ id: project.id, journalIds: [saved.id] });
					} catch (e) {
						console.error("[project] auto-link note failed:", e);
					}
				}
			}
		} catch (_error) {
			return null;
		}
		if (!saved) return null;
		// 首次创建成功后，把 @ 选中的待处理链接正式落库
		if (pendingLinks.length > 0) {
			try {
				await Promise.all(
					pendingLinks.map((pl) =>
						createNoteLinkAsync({
							sourceNoteId: saved.id,
							input: { targetNoteId: pl.id, relationType: "SUPPORTS" },
						}),
					),
				);
			} catch (e) {
				console.error('Failed to flush pending links:', e);
			}
			setPendingLinks([]);
		}
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
		return saved;
	};
	handleSaveRef.current = handleSave;
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
			});
				if (result) {
					setAnnotateTarget(null);
					clearAfterSubmit.current = true;
					// 项目视图下批注产生的新笔记自动加入当前项目，使其出现在项目笔记列表
					if (projectViewOpen && project) {
						try {
							await addNotesAsync({ id: project.id, journalIds: [result.id] });
						} catch (e) {
							console.error("[project] auto-link annotation note failed:", e);
						}
					}
					// mutations 的 onSuccess 已触发 journals 重新获取，不再需显式 refetch。
					// 先设置 guard 再 await，避免后台查询在 async 间隙更新 activeJournal
					// 导致 sync effect 将批注内容写入 draft。
					try {
						await createNoteLinkAsync({
							sourceNoteId: result.id,
							input: { targetNoteId: annotateTarget.id, relationType: "SUPPORTS" },
						});
					} catch (e) {
						console.error("[annotate] failed to create NoteLink:", e);
					}
			}
		} catch (err) {
			console.error("[annotate] create failed:", err);
		}
	};
	const submitInFlightRef = useRef(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const handleSubmitNotes = async () => {
		if (!draft.userNotes.trim()) return;
		// 连点防护：上一次提交未返回前忽略后续点击（重试重复由服务端 uid 幂等兜底）
		if (submitInFlightRef.current) return;
		submitInFlightRef.current = true;
		setIsSubmitting(true);
		try {
			const saved = await handleSave();
			// 保存失败时保留草稿不清空，避免内容丢失
			if (!saved) return;
			// 新笔记已由 mutation onSuccess 直接写入列表/统计缓存，无需全量 refetch
			setNotesResetSignal((v) => v + 1);
			setDraft((prev) => ({ ...prev, id: null, userNotes: "", name: "" }));
			clearAfterSubmit.current = true;
		} finally {
			submitInFlightRef.current = false;
			setIsSubmitting(false);
		}
	};
	// 聊天工具改动了笔记：若正是当前打开的笔记，重新拉取并只同步标签（不触碰正文/标题，避免覆盖编辑中内容）
	// 注意必须放在 journalError 提前 return 之前，否则错误态渲染会少跑这个 hook 导致 React 崩溃
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
		return ( <>
			<div className="flex h-full flex-col overflow-hidden bg-gray-100/60 dark:bg-zinc-900/20">
			<div ref={containerRef} className={cn("flex min-h-0 flex-1 overflow-hidden gap-1 px-3 relative", isMobile && "px-0")}>
				{/* Left sidebar — inline when wide, otherwise hidden (drawer overlay) */}
				{showLeftInline && <DiarySidebar width={leftWidth} stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} hideFilterActive={projectViewOpen} onFilterModeChange={(mode) => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(false); setSelectedTag(null); setFilterMode(mode); if (mode === "all") setHeatmapFilterDate(null); }} onRestore={handleRestore} onSelectDate={(date) => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(false); setSelectedTag(null); setHeatmapFilterDate(date); setFilterMode("all"); }}  onShowTrash={() => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(true); }} onShowArchive={() => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowArchivedProjects((v) => !v); }} archiveViewActive={showArchivedProjects} selectedTag={selectedTag} onSelectTag={(tag) => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(false); setSelectedTag(tag); if (tag) { setFilterMode("all"); } }} selectedCollectionId={selectedCollectionId} onSelectCollection={selectCollection} selectedProjectId={storeSelectedProjectId} onSelectProject={openProjectView} onCloseProject={closeProjectView} timeMachineActive={!!pendingTimeMachineDate || !!timeMachineDate} onTimeMachine={handleTimeMachine} />}
				{showLeftInline && (
					<ResizeHandle
						onPointerDown={handleLeftResizePointerDown}
						isDragging={isDraggingLeft}
					/>
				)}
				<div className="flex-1 min-w-0 flex flex-col overflow-hidden">
					{collectionView === "gallery" ? (
						<CollectionGallery onSelectCollection={selectCollection} />
					) : collectionView === "detail" && selectedCollectionId ? (
						<CollectionDetail
							collectionId={selectedCollectionId}
							onBack={() => setCollectionView("gallery")}
						/>
					) : projectViewOpen && storeSelectedProjectId ? (
						<>
						{project ? (
						<DiaryEditor
							draft={draft}
							filterMode={filterMode}
							tagFilter={selectedTag}
							heatmapFilterDate={heatmapFilterDate}
							onClearHeatmapFilter={() => setHeatmapFilterDate(null)}
						timeMachineDate={timeMachineDate}
						timeMachinePending={pendingTimeMachineDate}
						onTimeMachineSettled={commitTimeMachine}
						onTimeMachineLaunch={handleTimeMachine}
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
							noteLinkList={noteLinkList}
							onLinkNote={handleLinkNote}
							onRemoveLink={handleRemoveLink}
							linkedNoteTitles={pendingLinks}
							onTitleChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
							onUserNotesChange={(value) => setDraft((prev) => ({ ...prev, userNotes: value }))}
							onUserNotesBlur={(value) => handleAutoSave({ draftOverride: { userNotes: value } })}
							onSubmit={handleSubmitNotes}
							submitting={isSubmitting}
							notesResetSignal={notesResetSignal}
							onInlineTag={handleInlineTag}
							showLeftToggle={!showLeftInline}
							showRightToggle
							isLeftOpen={leftDrawerOpen}
							isRightOpen={rightDrawerOpen}
							onToggleLeft={() => setLeftDrawerOpen(!leftDrawerOpen)}
							onToggleRight={() => setRightDrawerOpen(!rightDrawerOpen)}
							filterJournalIds={projectFilterJournalIds}
							headerSlot={
								<ProjectHeader
									project={project}
									manageLabel={tProject("manageNotes")}
									onManageClick={() => setProjectNoteManagerOpen(true)}
								/>
							}
						/>
						) : null}
						{projectNoteManagerOpen && project && (
							<ProjectNoteManager
								projectId={project.id}
								memberIds={project.notes?.map((n) => n.id) ?? []}
								onClose={() => setProjectNoteManagerOpen(false)}
							/>
						)}
						</>
					) : showArchivedProjects ? (
						<ProjectArchiveView projects={archivedProjects} />
					) : showTrash ? (
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
						timeMachineDate={timeMachineDate}
						timeMachinePending={pendingTimeMachineDate}
						onTimeMachineSettled={commitTimeMachine}
						onTimeMachineLaunch={handleTimeMachine}
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
							noteLinkList={noteLinkList}
							onLinkNote={handleLinkNote}
							onRemoveLink={handleRemoveLink}
							linkedNoteTitles={pendingLinks}
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
							submitting={isSubmitting}
							notesResetSignal={notesResetSignal}
							onInlineTag={handleInlineTag}
							showLeftToggle={!showLeftInline}
							showRightToggle
							isLeftOpen={leftDrawerOpen}
							isRightOpen={rightDrawerOpen}
							onToggleLeft={() => setLeftDrawerOpen(!leftDrawerOpen)}
							onToggleRight={() => setRightDrawerOpen(!rightDrawerOpen)}
						/>
						</>
					)}
				</div>
		{/* Right-side chat panel for AI analysis — inline when wide, otherwise hidden (drawer overlay) */}
		{showRightInline && collectionView === "none" && rightDrawerOpen && (
			<>
				<ResizeHandle
					onPointerDown={handleRightResizePointerDown}
					isDragging={isDraggingRight}
				/>
				<div className="flex-shrink flex flex-col rounded-(--radius) bg-[oklch(var(--card))] shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_3px_0_rgba(0,0,0,0.06)] overflow-hidden" style={{ width: rightWidth }}>
					<DiaryChatPanel noteContent={noteContent} currentJournalId={activeJournal?.id ?? null} onClose={() => setRightDrawerOpen(false)} onNoteMutated={handleNoteMutated} />
				</div>
			</>
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
						<DiarySidebar stats={stats ?? { totalNotes: 0, totalTags: 0, totalDays: 0, dailyCounts: new Map(), tagsWithCount: [], dates: [], maxDailyCount: 1 }} filterMode={filterMode} hideFilterActive={projectViewOpen} onFilterModeChange={(mode) => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(false); setSelectedTag(null); setFilterMode(mode); if (mode === "all") setHeatmapFilterDate(null); }} onRestore={handleRestore} onSelectDate={(date) => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(false); setSelectedTag(null); setHeatmapFilterDate(date); setFilterMode("all"); }}  onShowTrash={() => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(true); }} onShowArchive={() => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowArchivedProjects((v) => !v); }} archiveViewActive={showArchivedProjects} selectedTag={selectedTag} onSelectTag={(tag) => { clearProjectView(); clearTimeMachine(); setCollectionView("none"); setShowTrash(false); setSelectedTag(tag); if (tag) { setFilterMode("all"); } }} selectedCollectionId={selectedCollectionId} onSelectCollection={selectCollection} selectedProjectId={storeSelectedProjectId} onSelectProject={openProjectView} onCloseProject={closeProjectView} timeMachineActive={!!pendingTimeMachineDate || !!timeMachineDate} onTimeMachine={handleTimeMachine} />
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
						className={cn(
							"absolute right-0 top-0 z-40 h-full shadow-xl",
							isMobile ? "w-full" : "w-[min(380px,85vw)]",
						)}
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