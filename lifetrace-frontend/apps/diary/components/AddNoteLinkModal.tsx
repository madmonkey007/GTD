"use client";

import { ArrowRight, Loader2, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLinkCandidates, useNoteLinkMutations } from "@/lib/query/note-links";
import { useJournals } from "@/lib/query/journals";

interface AddNoteLinkModalProps {
	isOpen: boolean;
	onClose: () => void;
	noteId: number;
	noteName: string;
}

/**
 * 添加链接：无搜索词时用相似度推荐，有搜索词时调后端全量搜索。
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

	// 有搜索词时: 从后端全量搜索
	const { data: searchResult, isLoading: searchLoading } = useJournals(
		searchDebounce.trim()
			? { limit: 50, search: searchDebounce.trim() }
			: undefined,
	);

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

	// 候选列表（无搜索词 → 相似度推荐；有搜索词 → 全量搜索结果）
	const items = useMemo(() => {
		if (searchDebounce.trim()) {
			return (searchResult?.journals ?? [])
				.filter((n) => n.id !== noteId)
				.map((n) => ({
					id: n.id,
					name: n.name ?? "",
					preview: (n.userNotes ?? "").replace(/[\r\n]/g, " ").slice(0, 80),
					score: 0,
				}));
		}
		return (candidates ?? []).filter((c) => {
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return (
				(c.name || "").toLowerCase().includes(q) ||
				c.preview.toLowerCase().includes(q)
			);
		});
	}, [candidates, search, searchDebounce, searchResult, noteId]);

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
					<div className="text-[10px] text-muted-foreground/50 leading-relaxed">
						搜索框输入关键词可检索全部笔记；未输入时按语义相似度推荐
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
