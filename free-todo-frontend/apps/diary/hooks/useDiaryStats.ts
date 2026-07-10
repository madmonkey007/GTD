"use client";

import { useMemo, useState } from "react";
import { formatDateInput, parseJournalDate } from "@/apps/diary/journal-utils";
import { useJournals } from "@/lib/query";

export type DiaryFilterMode = "all" | "last7" | "random";

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
		return new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() + 1,
		);
	}, []);

	const { data, isLoading, error } = useJournals({
		limit: 200,
		startDate: startDate.toISOString(),
		endDate: endDate.toISOString(),
	});

	const stats = useMemo<DiaryStatsData | undefined>(() => {
		if (!data?.journals) return undefined;

		const journals = data.journals;
		const dailyCounts = new Map<string, number>();
		const tagCountMap = new Map<string, number>();
		const daySet = new Set<string>();

		for (const journal of journals) {
			const dateKey = formatDateInput(parseJournalDate(journal.date));
			dailyCounts.set(dateKey, (dailyCounts.get(dateKey) ?? 0) + 1);
			daySet.add(dateKey);

			for (const tag of journal.tags ?? []) {
				tagCountMap.set(tag.tagName, (tagCountMap.get(tag.tagName) ?? 0) + 1);
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
			totalNotes: journals.length,
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
	};
}
