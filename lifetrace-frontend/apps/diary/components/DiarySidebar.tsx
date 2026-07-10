"use client";

import { useTranslations } from "next-intl";
import type { DiaryFilterMode, DiaryStatsData } from "@/apps/diary/hooks/useDiaryStats";
import { DiaryFilterBar } from "./DiaryFilterBar";
import { DiaryHeatmap } from "./DiaryHeatmap";
import { DiaryStats } from "./DiaryStats";
import { DiaryTagList } from "./DiaryTagList";
import type { TrashEntry } from "@/apps/diary/hooks/useJournalTrash";
import { DiaryTrashList } from "./DiaryTrashList";

interface DiarySidebarProps {
	stats: DiaryStatsData;
	filterMode: DiaryFilterMode;
	onFilterModeChange: (mode: DiaryFilterMode) => void;
	onSelectDate?: (date: Date) => void;
	onRestore?: (entry: TrashEntry) => void;
	onShowTrash?: () => void;
	selectedTag?: string | null;
	onSelectTag?: (tagName: string | null) => void;
}

export function DiarySidebar({
	stats,
	filterMode,
	onFilterModeChange,
	onSelectDate,
	onRestore,
	onShowTrash,
	selectedTag,
	onSelectTag,
}: DiarySidebarProps) {
	const t = useTranslations("journalPanel");

	return (
		<aside className="w-72 shrink-0 border-r border-border/40 overflow-y-auto bg-background px-3 py-3 flex flex-col gap-4">
			{/* Stats */}
			<DiaryStats
				totalNotes={stats.totalNotes}
				totalTags={stats.totalTags}
				totalDays={stats.totalDays}
			/>

			{/* Heatmap section */}
			<div>
				<div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
					{t("sidebarActivity")}
				</div>
				<DiaryHeatmap
					dates={stats.dates}
					dailyCounts={stats.dailyCounts}
					onSelectDate={onSelectDate}
				/>
			</div>

			{/* Filter */}
			<DiaryFilterBar
				filterMode={filterMode}
				onFilterModeChange={onFilterModeChange}
			/>

			{/* Tags */}
			<DiaryTagList tagsWithCount={stats.tagsWithCount} selectedTag={selectedTag} onSelectTag={onSelectTag} />

			{/* Trash */}
			<DiaryTrashList onRestore={onRestore} onShowTrash={onShowTrash} />
		</aside>
	);
}
