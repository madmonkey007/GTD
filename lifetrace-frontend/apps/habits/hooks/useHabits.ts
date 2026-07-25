"use client";

import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	type Habit,
	type HabitInput,
	type HabitRecord,
	migrateLocalHabitsIfNeeded,
	useHabitMutations,
	useHabitRecordsQuery,
	useHabitsQuery,
} from "@/lib/query/habits";
import { queryKeys } from "@/lib/query/keys";

export type { Habit, HabitRecord, HabitInput };

const DEFAULT_ICON = "✅";

const DEFAULT_HABIT_ICONS = [
	"📚", "🏃", "🧘", "💪", "🎯",
	"✍️", "🎨", "🎵", "🌱", "💧",
	"🥗", "☕", "💊", "🧠", "📝",
	"📖", "🗣️", "🤝", "🏠", "🌅",
	"🌙", "🧹", "💰", "🎓", "🧩",
	"🎮", "📷", "🌍", "🧭", "🔥",
];

function toDateKey(date: Date): string {
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, "0");
	const d = `${date.getDate()}`.padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function getTodayKey(): string {
	return toDateKey(new Date());
}

/**
 * 习惯 hook —— 现已由服务器（/api/habits）支撑，对外接口保持不变。
 * 内部把服务器 int id 映射为 string（见 lib/query/habits.ts），旧调用方无需改动。
 * 首次挂载时若本地有旧 localStorage 数据，会一次性迁移到服务器。
 */
export function useHabits() {
	const queryClient = useQueryClient();
	const habitsQuery = useHabitsQuery();
	const recordsQuery = useHabitRecordsQuery();
	const mutations = useHabitMutations();

	// 一次性迁移本地旧数据，完成后刷新查询
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const did = await migrateLocalHabitsIfNeeded();
			if (did && !cancelled) {
				queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [queryClient]);

	const habits = habitsQuery.data ?? [];
	const records = recordsQuery.data ?? [];

	const addHabit = useCallback(
		(name: string, extra?: {
			icon?: string;
			frequency?: Habit["frequency"];
			goal?: Habit["goal"];
			startDate?: string;
			persistenceDays?: number;
			group?: Habit["group"];
		}) => {
			void mutations.createHabit({
				name,
				icon: extra?.icon,
				frequency: extra?.frequency,
				goal: extra?.goal,
				startDate: extra?.startDate ?? getTodayKey(),
				persistenceDays: extra?.persistenceDays,
				group: extra?.group,
			});
		},
		[mutations],
	);

	const removeHabit = useCallback(
		(id: string) => {
			void mutations.deleteHabit(id);
		},
		[mutations],
	);

	const renameHabit = useCallback(
		(id: string, name: string) => {
			void mutations.updateHabit(id, { name });
		},
		[mutations],
	);

	const toggleRecord = useCallback(
		(habitId: string, date?: string) => {
			void mutations.toggleHabitRecord(habitId, date);
		},
		[mutations],
	);

	const isChecked = useCallback(
		(habitId: string, date?: string): boolean => {
			const dateKey = date ?? getTodayKey();
			return records.some((r) => r.habitId === habitId && r.date === dateKey);
		},
		[records],
	);

	return {
		habits,
		records,
		addHabit,
		removeHabit,
		renameHabit,
		toggleRecord,
		isChecked,
	};
}

export { DEFAULT_HABIT_ICONS, toDateKey };

export function countMonthlyRecords(
	records: HabitRecord[],
	habitId: string,
	year: number,
	month: number,
): number {
	const monthStr = `${year}-${`${month}`.padStart(2, "0")}`;
	const seen = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId && r.date.startsWith(monthStr)) {
			seen.add(r.date);
		}
	}
	return seen.size;
}

export function countTotalRecords(
	records: HabitRecord[],
	habitId: string,
): number {
	const seen = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId) seen.add(r.date);
	}
	return seen.size;
}

export function countAllRecords(
	records: HabitRecord[],
	habitId: string,
): number {
	return records.filter((r) => r.habitId === habitId).length;
}

export function countRecentRecords(
	records: HabitRecord[],
	habitId: string,
	days: number,
): number {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days + 1);
	const cutoffKey = toDateKey(cutoff);
	const seen = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId && r.date >= cutoffKey) {
			seen.add(r.date);
		}
	}
	return seen.size;
}

export function calcMonthlyRate(
	records: HabitRecord[],
	habitId: string,
	year: number,
	month: number,
): number {
	const checked = countMonthlyRecords(records, habitId, year, month);
	const today = new Date();
	const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
	const totalDays = isCurrentMonth
		? today.getDate()
		: new Date(year, month, 0).getDate();
	return totalDays > 0 ? Math.round((checked / totalDays) * 100) : 0;
}

export function calcStreak(
	records: HabitRecord[],
	habitId: string,
): number {
	const checkedSet = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId) checkedSet.add(r.date);
	}

	let streak = 0;
	const today = new Date();
	for (let i = 0; i < 365; i++) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const key = toDateKey(d);
		if (checkedSet.has(key)) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}
