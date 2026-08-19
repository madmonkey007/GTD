"use client";

import { ArrowRight, Loader2, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLinkCandidates, useNoteLinkMutations } from "@/lib/query/note-links";
import { useJournalLites, useJournals } from "@/lib/query/journals";
import {
	aggregateTags,
	DEFAULT_NOTE_PICKER_FILTERS,
	filterAndSort,
	liteToPickerRow,
	NotePickerFilters,
	type NotePickerFiltersState,
} from "@/apps/diary/components/NotePickerFilters";

interface AddNoteLinkModalProps {
	isOpen: boolean;
	onClose: () => void;
	noteId: number;
	noteName: string;
}

/**
 * 添加链接：无搜索词时用相似度推荐，有搜索词时调后端全量搜索。
 * 未选排序/标签时保持默认列表；选择后切换到按条件过滤的全量结果。
 */
export function AddNoteLinkModal({
	isOpen,
	onClose,
	noteId,
	noteName,
}: AddNoteLinkModalProps) {
	const { data: candidates, isLoading: candidatesLoading } = useLinkCandidates(
		isOpen ? noteId : null,
		15,
	);
	const { createNoteLinkAsync } = useNoteLinkMutations();
	const [search, setSearch] = useState("");
	const [searchDebounce, setSearchDebounce] = useState("");
	const [busyId, setBusyId] = useState<number | null>(null);
	const [pickerFilters, setPickerFilters] = useState<NotePickerFiltersState>(
		DEFAULT_NOTE_PICKER_FILTERS,
	);

	// 全量笔记（轻量端点）：提供排序/标签筛选所需的 createdAt / tags 字段（缓存与 DiaryPanel 共享）
	const { data: liteData } = useJournalLites(
		isOpen ? { limit: 1000 } : undefined,
	);
	const allRows = useMemo(
		() => (liteData?.notes ?? []).map(liteToPickerRow),
		[liteData],
	);
	const journalById = useMemo(() => {
		const map = new Map<number, (typeof allRows)[number]>();
		for (const j of allRows) map.set(j.id, j);
		return map;
	}, [allRows]);
	const allTags = useMemo(() => aggregateTags(allRows), [allRows]);
	const filterActive =
		pickerFilters.sort !== "default" || pickerFilters.tag !== "all";

	// 候选为空（向量库无数据/AI 不可用/加载中）时回退到最近笔记，保证弹窗有内容且即时
	const latestRows = useMemo(
		() =>
			[...allRows]
				.sort(
					(a, b) =>
						new Date(b.createdAt ?? 0).getTime() -
						new Date(a.createdAt ?? 0).getTime(),
				)
				.slice(0, 15),
		[allRows],
	);

	// 有搜索词时: 从后端全量搜索（未输入时不发请求）
	const { data: searchResult, isLoading: searchLoading } = useJournals({
		limit: 50,
		search: searchDebounce.trim() || undefined,
		enabled: !!searchDebounce.trim(),
	});

	// 防抖：用户停止输入 300ms 后发起搜索
	const debounceTimer = useMemo(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		return (val: string) => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => setSearchDebounce(val), 300);
		};
	}, []);

	const handleSearchChange = (val: string) => {
		setSearch(val);
		debounceTimer(val);
	};

	// 候选列表：
	// - 有搜索词 → 后端全量搜索结果（叠加排序/标签过滤）
	// - 无搜索词但选了排序/标签 → 全量笔记按条件过滤（替代推荐）
	// - 否则 → 相似度推荐（默认）
	const items = useMemo(() => {
		if (searchDebounce.trim()) {
			return filterAndSort(
				(searchResult?.journals ?? []).filter((n) => n.id !== noteId),
				pickerFilters,
			).map((n) => ({
				id: n.id,
				name: n.name ?? "",
				preview: (n.userNotes ?? "").replace(/[\r\n]/g, " ").slice(0, 80),
				score: 0,
			}));
		}
		if (filterActive) {
			return filterAndSort(
				allRows.filter((n) => n.id !== noteId),
				pickerFilters,
			).map((n) => ({
				id: n.id,
				name: n.name ?? "",
				preview: (n.userNotes ?? "").replace(/[\r\n]/g, " ").slice(0, 80),
				score: 0,
			}));
		}
		// 默认推荐：优先 AI 相似候选；为空/加载中时回退到最近笔记，避免弹窗空转
		const pool =
			candidates && candidates.length > 0
				? candidates
				: latestRows.map((r) => ({
						id: r.id,
						name: r.name ?? "",
						preview: (r.userNotes ?? "")
							.replace(/[\r\n]/g, " ")
							.slice(0, 80),
						score: 0,
					}));
		return pool
			.filter((c) => {
				if (c.id === noteId) return false;
				const q = search.trim().toLowerCase();
				if (!q) return true;
				return (
					(c.name || "").toLowerCase().includes(q) ||
					c.preview.toLowerCase().includes(q)
				);
			})
			.map((c) => ({
				...c,
				// 推荐候选缺 createdAt/tags；用全量 Map 补齐以便展示排序一致性
				createdAt: journalById.get(c.id)?.createdAt,
				tags: journalById.get(c.id)?.tags,
			}))
			// 默认排序按时间（最新在前），相似度分数仅作展示
			.sort((a, b) => {
				const ta = new Date(a.createdAt ?? 0).getTime();
				const tb = new Date(b.createdAt ?? 0).getTime();
				if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
				return tb - ta;
			});
	}, [
		candidates,
		search,
		searchDebounce,
		searchResult,
		noteId,
		allRows,
		latestRows,
		journalById,
		pickerFilters,
		filterActive,
	]);

	const handlePick = async (targetId: number) => {
		setBusyId(targetId);
		try {
			await createNoteLinkAsync({
				sourceNoteId: noteId,
				input: { targetNoteId: targetId },
			});
			onClose();
		} finally {
			setBusyId(null);
		}
	};

	const isLoading = candidatesLoading || searchLoading;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="w-[95vw] max-w-[560px] h-[70vh] max-h-[520px] gap-0 p-0 overflow-hidden flex flex-col">
				<DialogTitle className="sr-only">添加链接</DialogTitle>
				<div className="px-4 pt-3 pb-2 border-b border-border/20 bg-muted/10">
					<div className="text-xs font-semibold text-foreground/90 mb-0.5">
						添加链接
					</div>
					<div className="text-[10px] text-muted-foreground/50 leading-relaxed truncate">
						当前笔记：{noteName} · 搜索框输入关键词可检索全部笔记
					</div>
				</div>
				<div className="relative p-2 border-b border-border/20">
					<SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
					<input
						type="text"
						value={search}
						onChange={(e) => handleSearchChange(e.target.value)}
						placeholder="搜索全部笔记..."
						className="w-full h-8 rounded-md border border-border/30 bg-background/50 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30"
					/>
				</div>
					<NotePickerFilters
						allTags={allTags}
						filters={pickerFilters}
						onFiltersChange={setPickerFilters}
					/>
				<div className="flex-1 overflow-y-auto">
					{isLoading && items.length === 0 && (
						<div className="px-3 py-6 text-xs text-muted-foreground/50 text-center flex items-center justify-center gap-2">
							<Loader2 className="w-3 h-3 animate-spin" />
							加载...
						</div>
					)}
					{!isLoading && items.length === 0 && (
						<div className="px-3 py-6 text-xs text-muted-foreground/50 text-center">
							{searchDebounce.trim()
								? "未找到匹配的笔记"
								: "暂无候选笔记"}
						</div>
					)}
					{items.map((c) => (
						<button
							key={c.id}
							type="button"
							onClick={() => handlePick(c.id)}
							disabled={busyId !== null}
							className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors border-b border-border/20 last:border-0 disabled:opacity-50"
						>
							<div className="flex-1 min-w-0">
								{c.name && (
									<div className="text-[10px] text-muted-foreground/40 truncate mb-0.5">
										{c.name}
									</div>
								)}
								<div className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
									{c.preview || "（无内容）"}
								</div>
							</div>
							{c.score > 0 && (
								<div className="flex flex-col items-end gap-1 shrink-0 w-12">
									<span className="text-[10px] text-primary/60 tabular-nums">
										{Math.round(c.score * 100)}%
									</span>
									<div className="w-full h-1 rounded-full bg-muted overflow-hidden">
										<div
											className="h-full bg-primary/50"
											style={{
												width: `${Math.max(4, Math.round(c.score * 100))}%`,
											}}
										/>
									</div>
								</div>
							)}
							{busyId === c.id ? (
								<Loader2 className="w-3.5 h-3.5 text-primary/60 animate-spin shrink-0" />
							) : (
								<ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
							)}
						</button>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
