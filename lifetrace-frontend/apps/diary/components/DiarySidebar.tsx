"use client";

import { useTranslations } from "next-intl";
import type { DiaryFilterMode, DiaryStatsData } from "@/apps/diary/hooks/useDiaryStats";
import { ProjectList } from "@/apps/project";
import { CollectionList } from "./CollectionList";
import { DiaryFilterBar } from "./DiaryFilterBar";
import { DiaryHeatmap } from "./DiaryHeatmap";
import { DiaryStats } from "./DiaryStats";
import { DiaryTagList } from "./DiaryTagList";
import type { TrashEntry } from "@/apps/diary/hooks/useJournalTrash";
import { DiaryTrashList } from "./DiaryTrashList";
import { ProjectArchiveEntry } from "./ProjectArchiveEntry";

interface DiarySidebarProps {
	stats: DiaryStatsData;
	filterMode: DiaryFilterMode;
	onFilterModeChange: (mode: DiaryFilterMode) => void;
	/** 项目视图等场景下隐藏筛选高亮 */
	hideFilterActive?: boolean;
	onSelectDate?: (date: Date) => void;
	onRestore?: (entry: TrashEntry) => void;
	onShowTrash?: () => void;
	selectedTag?: string | null;
	onSelectTag?: (tagName: string | null) => void;
	selectedCollectionId?: number | null;
	onSelectCollection?: (id: number) => void;
	selectedProjectId?: number | null;
	onSelectProject?: (id: number) => void;
	onCloseProject?: () => void;
	/** 时光机是否激活（正在穿越 / 动画中） */
	timeMachineActive?: boolean;
	/** 时光机：随机穿越到过去的某一天 */
	onTimeMachine?: () => void;
	/** 项目归档视图激活态 */
	archiveViewActive?: boolean;
	/** 打开项目归档视图 */
	onShowArchive?: () => void;
}

export function DiarySidebar({
	stats,
	filterMode,
	onFilterModeChange,
	hideFilterActive,
	onSelectDate,
	onRestore,
	onShowTrash,
	selectedTag,
	onSelectTag,
	selectedCollectionId,
	onSelectCollection,
	selectedProjectId,
	onSelectProject,
	onCloseProject,
	timeMachineActive,
	onTimeMachine,
	archiveViewActive,
	onShowArchive,
}: DiarySidebarProps) {
	const t = useTranslations("journalPanel");

	return (
		<aside className="w-72 shrink-0 h-full border-r border-border/40 overflow-y-auto bg-background px-3 py-3 flex flex-col gap-4">
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

			{/* Filter（含时光机器 tab，位于待办笔记上方） */}
			<DiaryFilterBar
				filterMode={filterMode}
				onFilterModeChange={onFilterModeChange}
				hideActive={hideFilterActive}
				timeMachineActive={timeMachineActive}
				onTimeMachine={onTimeMachine}
			/>

			{/* Projects（项目入口：待办+笔记共享容器） */}
			<ProjectList
				feature="note"
				type="project"
				selectedProjectId={selectedProjectId}
				onSelectProject={onSelectProject}
				onCloseProject={onCloseProject}
			/>

			{/* Collections（集合入口，位于项目下方） */}
			<CollectionList
				selectedCollectionId={selectedCollectionId}
				onSelectCollection={onSelectCollection}
			/>

			{/* Tags */}
			<DiaryTagList tagsWithCount={stats.tagsWithCount} selectedTag={selectedTag} onSelectTag={onSelectTag} />

			{/* 项目归档入口（Trash 之上） */}
			<ProjectArchiveEntry active={archiveViewActive} onShowArchive={onShowArchive} />

			{/* Trash */}
			<DiaryTrashList onRestore={onRestore} onShowTrash={onShowTrash} />
		</aside>
	);
}
