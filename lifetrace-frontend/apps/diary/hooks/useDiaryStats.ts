"use client";

import { useMemo, useState } from "react";
import { formatDateInput, parseJournalDate } from "@/apps/diary/journal-utils";
import { extractTagsFromContent, useJournalLites } from "@/lib/query";

export type DiaryFilterMode = "all" | "last7" | "random" | "todo";

const HEATMAP_DAYS = 77;

interface TagsWithCount {
	tagName: string;
	count: number;
}

export interface DiaryStatsData {
	totalNotes: number;
	totalTags: number;
	totalDays: number;
	dailyCounts: Map<string, number>;
	tagsWithCount: TagsWithCount[];
	dates: Date[];
	maxDailyCount: number;
}

function getStartDate(mode: DiaryFilterMode): Date {
	const now = new Date();
	const days = mode === "last7" ? 7 : HEATMAP_DAYS;
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}

export function useDiaryStats() {
	const [filterMode, setFilterMode] = useState<DiaryFilterMode>("all");

	const startDate = useMemo(() => getStartDate(filterMode), [filterMode]);
	const endDate = useMemo(() => {
		const now = new Date();
		// 取「后天 00:00」而非「明天 00:00」：.toISOString() 会把本地时间转成 UTC，
		// 仅 +1 天在东八区会落到「今天 16:00 UTC」，导致数据库按 UTC 比较时把当天
		// 16:00 之后的笔记排除掉（统计总数偏小）。+2 天可兜底覆盖所有时区。
		return new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() + 2,
		);
	}, []);

	// 轻量端点：只拉 id/date/userNotes（服务端无 N+1 序列化），标签从正文提取
	const { data, isLoading, error, refetch } = useJournalLites({
		limit: 1000,
		startDate: startDate.toISOString(),
		endDate: endDate.toISOString(),
	});

	const stats = useMemo<DiaryStatsData | undefined>(() => {
		if (!data?.notes) return undefined;

		const notes = data.notes;
		const dailyCounts = new Map<string, number>();
		const tagCountMap = new Map<string, number>();
		const daySet = new Set<string>();

		for (const note of notes) {
			const dateKey = formatDateInput(parseJournalDate(note.date));
			dailyCounts.set(dateKey, (dailyCounts.get(dateKey) ?? 0) + 1);
			daySet.add(dateKey);

			for (const tag of extractTagsFromContent(note.userNotes ?? "")) {
				tagCountMap.set(tag, (tagCountMap.get(tag) ?? 0) + 1);
			}
		}

		const tagsWithCount = Array.from(tagCountMap.entries())
			.map(([tagName, count]) => ({ tagName, count }))
			.sort((a, b) => b.count - a.count);

		const now = new Date();
		const dates: Date[] = [];
		for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
			dates.push(d);
		}

		let maxDailyCount = 0;
		for (const count of dailyCounts.values()) {
			if (count > maxDailyCount) maxDailyCount = count;
		}
		maxDailyCount = Math.min(maxDailyCount, 5);

		return {
			totalNotes: notes.length,
			totalTags: tagCountMap.size,
			totalDays: daySet.size,
			dailyCounts,
			tagsWithCount,
			dates,
			maxDailyCount: Math.max(maxDailyCount, 1),
		};
	}, [data]);

	return {
		stats,
		isLoading,
		error,
		filterMode,
		setFilterMode,
		refetchStats: refetch,
	};
}
