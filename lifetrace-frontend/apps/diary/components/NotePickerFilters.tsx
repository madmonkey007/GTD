"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { extractTagsFromContent } from "@/lib/query/journals";

export type NoteSortMode = "default" | "newest" | "oldest";

export interface NotePickerFiltersState {
	sort: NoteSortMode;
	tag: string | "all";
}

/** 笔记选择器展示所需的最小行：JournalView 与 lite 行都满足 */
export interface NotePickerRow {
	id: number;
	name: string;
	createdAt: string;
	userNotes: string;
	tags: { tagName: string }[];
}

export const DEFAULT_NOTE_PICKER_FILTERS: NotePickerFiltersState = {
	sort: "default",
	tag: "all",
};

/** lite 行 → 笔记选择器行（标签从正文 #tag 提取，无需 N+1 关联查询） */
export function liteToPickerRow(note: {
	id: number;
	name: string;
	createdAt: string;
	userNotes: string;
}): NotePickerRow {
	return {
		id: note.id,
		name: note.name ?? "",
		userNotes: note.userNotes ?? "",
		createdAt: note.createdAt ?? "",
		tags: extractTagsFromContent(note.userNotes ?? "").map((tagName) => ({
			id: 0,
			tagName,
		})),
	};
}

/** 从全量笔记聚合标签（正文 #tag 提取），按出现次数降序。 */
export function aggregateTags(journals: NotePickerRow[]): string[] {
	const countMap = new Map<string, number>();
	for (const j of journals) {
		for (const tag of j.tags ?? []) {
			countMap.set(tag.tagName, (countMap.get(tag.tagName) ?? 0) + 1);
		}
	}
	return Array.from(countMap.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([tagName]) => tagName);
}

/** 先按标签过滤，再按发布时间排序。返回新数组，不改动入参。 */
export function filterAndSort(
	journals: NotePickerRow[],
	filters: NotePickerFiltersState,
): NotePickerRow[] {
	const tagFiltered =
		filters.tag === "all"
			? journals
			: journals.filter((j) =>
					(j.tags ?? []).some((t) => t.tagName === filters.tag),
				);
	if (filters.sort === "default") return tagFiltered;
	const sorted = [...tagFiltered].sort((a, b) => {
		const ta = new Date(a.createdAt).getTime();
		const tb = new Date(b.createdAt).getTime();
		if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
		return filters.sort === "newest" ? tb - ta : ta - tb;
	});
	return sorted;
}

interface NotePickerFiltersProps {
	allTags: string[];
	filters: NotePickerFiltersState;
	onFiltersChange: (filters: NotePickerFiltersState) => void;
}

/** 笔记选择弹窗共享的排序 + 标签筛选控件（原生 select，样式对齐 TodoFilter）。 */
export function NotePickerFilters({
	allTags,
	filters,
	onFiltersChange,
}: NotePickerFiltersProps) {
	const t = useTranslations("notePicker");

	const sortOptions: { value: NoteSortMode; label: string }[] = [
		{ value: "default", label: t("sortDefault") },
		{ value: "newest", label: t("sortNewest") },
		{ value: "oldest", label: t("sortOldest") },
	];

	return (
		<div className="mt-2 flex items-center gap-2">
			<div className="relative flex-1">
				<select
					value={filters.sort}
					onChange={(e) =>
						onFiltersChange({
							...filters,
							sort: e.target.value as NoteSortMode,
						})
					}
					className="h-8 w-full appearance-none rounded-md border border-border/30 bg-background pl-2 pr-7 text-xs text-foreground focus:border-primary/30 focus:outline-none"
				>
					{sortOptions.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
				<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
			</div>
			<div className="relative flex-1">
				<select
					value={filters.tag}
					onChange={(e) =>
						onFiltersChange({ ...filters, tag: e.target.value })
					}
					className="h-8 w-full appearance-none rounded-md border border-border/30 bg-background pl-2 pr-7 text-xs text-foreground focus:border-primary/30 focus:outline-none"
				>
					<option value="all">{t("tagAll")}</option>
					{allTags.map((tagName) => (
						<option key={tagName} value={tagName}>
							{tagName}
						</option>
					))}
				</select>
				<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
			</div>
		</div>
	);
}
