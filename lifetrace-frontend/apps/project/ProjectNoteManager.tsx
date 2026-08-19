"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useJournals, useJournalLites, useProjectMutations } from "@/lib/query";
import {
	aggregateTags,
	DEFAULT_NOTE_PICKER_FILTERS,
	filterAndSort,
	liteToPickerRow,
	NotePickerFilters,
	type NotePickerFiltersState,
} from "@/apps/diary/components/NotePickerFilters";
import { cn } from "@/lib/utils";

interface ProjectNoteManagerProps {
	projectId: number;
	memberIds: number[];
	onClose: () => void;
}

/** 管理项目笔记成员：从全部笔记里勾选加入/移除。 */
export function ProjectNoteManager({
	projectId,
	memberIds,
	onClose,
}: ProjectNoteManagerProps) {
	const t = useTranslations("project");
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "member" | "other">("all");
	const [pickerFilters, setPickerFilters] = useState<NotePickerFiltersState>(
		DEFAULT_NOTE_PICKER_FILTERS,
	);
	// 默认列表/标签用轻量端点（无 N+1）；只有输入搜索词时才走全量搜索接口
	const { data: liteData } = useJournalLites({ limit: 1000 });
	const { data: searchData } = useJournals({
		limit: 50,
		search: search.trim() || undefined,
		enabled: !!search.trim(),
	});
	const { addNotesAsync, removeNote, isPending } = useProjectMutations();

	const [selected, setSelected] = useState<Set<number>>(
		() => new Set(memberIds),
	);

	const liteRows = useMemo(
		() => (liteData?.notes ?? []).map(liteToPickerRow),
		[liteData],
	);
	const journals = search.trim() ? (searchData?.journals ?? []) : liteRows;
	const memberSet = useMemo(() => new Set(memberIds), [memberIds]);
	const memberCount = memberIds.length;

	const allTags = useMemo(() => aggregateTags(liteRows), [liteRows]);

	const filtered = filterAndSort(
		journals.filter((j) =>
			filter === "all"
				? true
				: filter === "member"
					? memberSet.has(j.id)
					: !memberSet.has(j.id),
		),
		pickerFilters,
	);

	const counts = useMemo(() => {
		let added = 0;
		let removed = 0;
		for (const j of journals) {
			const was = memberIds.includes(j.id);
			const now = selected.has(j.id);
			if (!was && now) added++;
			if (was && !now) removed++;
		}
		return { added, removed };
	}, [journals, selected, memberIds]);

	const toggle = (id: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleSave = async () => {
		const toAdd: number[] = [];
		const toRemove: number[] = [];
		for (const j of journals) {
			const was = memberIds.includes(j.id);
			const now = selected.has(j.id);
			if (!was && now) toAdd.push(j.id);
			if (was && !now) toRemove.push(j.id);
		}
		if (toAdd.length > 0)
			await addNotesAsync({ id: projectId, journalIds: toAdd });
		for (const jid of toRemove) removeNote({ id: projectId, journalId: jid });
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div className="flex h-[80vh] w-full max-w-lg flex-col rounded-(--radius) bg-background shadow-xl">
				<div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
					<h3 className="text-sm font-semibold">{t("manageNotes")}</h3>
					<button
						type="button"
						onClick={onClose}
						className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/40"
						aria-label={t("close")}
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="border-b border-border/40 p-3 pb-2">
					<div className="relative">
						<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("searchNotes")}
							className="h-8 w-full rounded-md border border-border/40 bg-background pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
					<div className="mt-2 flex items-center gap-0.5 rounded-md border border-border/40 p-0.5 text-xs">
						{(
							[
								["all", t("filterAll")],
								["member", `${t("filterMember")} (${memberCount})`],
								["other", t("filterOther")],
							] as const
						).map(([key, label]) => (
							<button
								key={key}
								type="button"
								onClick={() => setFilter(key)}
								className={cn(
									"flex-1 rounded px-2 py-1 font-medium transition-colors",
									filter === key
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted/40",
								)}
							>
								{label}
							</button>
						))}
					</div>
					<NotePickerFilters
						allTags={allTags}
						filters={pickerFilters}
						onFiltersChange={setPickerFilters}
					/>
					</div>

				<div className="flex-1 overflow-y-auto p-2">
					{filtered.length === 0 ? (
						<p className="px-3 py-6 text-center text-xs text-muted-foreground">
							{t("noCandidates")}
						</p>
					) : (
						filtered.map((j) => {
							const isMember = selected.has(j.id);
							return (
								<button
									key={j.id}
									type="button"
									onClick={() => toggle(j.id)}
									className={cn(
										"flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
										isMember
											? "bg-primary/10 text-primary"
											: "text-foreground hover:bg-muted/40",
									)}
								>
									<span
										className={cn(
											"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
											isMember
												? "border-primary bg-primary text-primary-foreground"
												: "border-border/60",
										)}
									>
										{isMember && <span className="text-[10px]">✓</span>}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[11px] text-muted-foreground/60">
											{j.name}
										</span>
										<span className="block truncate font-medium">
											{(j.userNotes || "")
												.replace(/[#\n]/g, " ")
												.trim() || t("emptyNote")}
										</span>
									</span>
								</button>
							);
						})
					)}
				</div>

				<div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-3">
					<span className="text-xs text-muted-foreground">
						{counts.added > 0 && `+${counts.added} `}
						{counts.removed > 0 && `-${counts.removed}`}
						{counts.added === 0 && counts.removed === 0 && t("noChange")}
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
						>
							{t("cancel")}
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={isPending}
							className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{t("save")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
