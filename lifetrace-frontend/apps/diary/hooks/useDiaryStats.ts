"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetcher } from "@/lib/api/fetcher";
import { formatDateInput, getLocalRangeApi, parseJournalDate } from "@/apps/diary/journal-utils";
import { extractTagsFromContent, useJournalLites } from "@/lib/query";

export type DiaryFilterMode = "all" | "last7" | "random" | "todo";

// 26 周（182 天）：覆盖左栏拖到最宽（480px ≈ 18 列）时的热力图数据需求
const HEATMAP_DAYS = 182;

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
	pinnedTags: Set<string>;
	dates: Date[];
	maxDailyCount: number;
}

function getStartDate(mode: DiaryFilterMode): Date {
	const now = new Date();
	const days = mode === "last7" ? 7 : HEATMAP_DAYS;
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}

function unwrapPinned(res: unknown): string[] {
	const data = (res as { data?: unknown })?.data ?? res;
	return Array.isArray(data) ? data.filter((v): v is string => typeof v === "string") : [];
}

export function useDiaryStats() {
	const [filterMode, setFilterMode] = useState<DiaryFilterMode>("all");

	const startDate = useMemo(() => getStartDate(filterMode), [filterMode]);
	const endDate = useMemo(() => {
		const now = new Date();
		return new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() + 2,
		);
	}, []);
	const statsRange = useMemo(() => getLocalRangeApi(startDate, endDate), [startDate, endDate]);

	// 轻量端点：只拉 id/date/userNotes（服务端无 N+1 序列化），标签从正文提取
	const { data, isLoading, error, refetch } = useJournalLites({
		limit: 1000,
		startDate: statsRange.startDate,
		endDate: statsRange.endDate,
	});

	// 置顶标签：控制侧栏排序（置顶优先），标签操作后随 journals 失效刷新
	const { data: pinnedTags } = useQuery({
		queryKey: ["journals", "tags", "pinned"],
		staleTime: 5 * 60 * 1000,
		queryFn: () => customFetcher<string[]>("/api/journals/tags/pinned").then((res) => unwrapPinned(res)),
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

		const pinned = new Set(pinnedTags ?? []);
		const tagsWithCount = Array.from(tagCountMap.entries())
			.map(([tagName, count]) => ({ tagName, count }))
			.sort((a, b) => {
				const pa = pinned.has(a.tagName) ? 0 : 1;
				const pb = pinned.has(b.tagName) ? 0 : 1;
				if (pa !== pb) return pa - pb;
				return b.count - a.count;
			});

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
			pinnedTags: pinned,
			dates,
			maxDailyCount: Math.max(maxDailyCount, 1),
		};
	}, [data, pinnedTags]);

	return {
		stats,
		isLoading,
		error,
		filterMode,
		setFilterMode,
		refetchStats: refetch,
	};
}
