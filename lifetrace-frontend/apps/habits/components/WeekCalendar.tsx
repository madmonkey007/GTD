"use client";

import { Check } from "lucide-react";
import React, { useMemo } from "react";
import type { Habit, HabitRecord } from "@/apps/habits/hooks/useHabits";
import { useLocaleStore } from "@/lib/store/locale";
import { cn } from "@/lib/utils";

interface WeekCalendarProps {
	habits: Habit[];
	records: HabitRecord[];
	onToggleDate: (habitId: string, date: string) => void;
}

function toDateKey(date: Date): string {
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, "0");
	const d = `${date.getDate()}`.padStart(2, "0");
	return `${y}-${m}-${d}`;
}

interface DayInfo {
	date: Date;
	key: string;
	weekday: string;
	dayNumber: number;
	isToday: boolean;
}

function buildLast7Days(locale: string): DayInfo[] {
	const WEEKDAY_LABELS_ZH = ["日", "一", "二", "三", "四", "五", "六"];
	const WEEKDAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const WEEKDAY_LABELS = locale === "zh" ? WEEKDAY_LABELS_ZH : WEEKDAY_LABELS_EN;
	const todayKey = toDateKey(new Date());
	const result: DayInfo[] = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		result.push({
			date: d,
			key: toDateKey(d),
			weekday: WEEKDAY_LABELS[d.getDay()],
			dayNumber: d.getDate(),
			isToday: toDateKey(d) === todayKey,
		});
	}
	return result;
}

export function WeekCalendar({
	habits,
	records,
	onToggleDate,
}: WeekCalendarProps) {
	const locale = useLocaleStore((s) => s.locale);
	const days = useMemo(() => buildLast7Days(locale), [locale]);

	const checkedMap = useMemo(() => {
		const map = new Map<string, Set<string>>();
		for (const r of records) {
			if (!map.has(r.habitId)) {
				map.set(r.habitId, new Set());
			}
			map.get(r.habitId)!.add(r.date);
		}
		return map;
	}, [records]);

	return (
		<div className="overflow-x-auto">
			<div className="grid grid-cols-[repeat(7,1fr)] gap-y-1 min-w-0">
				{/* Header row: empty corner + weekday labels */}
				{days.map((day) => (
					<div
						key={day.key}
						className="flex flex-col items-center gap-0.5 py-1"
					>
						<span className="text-[10px] font-medium text-muted-foreground/50">
							{day.weekday}
						</span>
						{day.isToday ? (
						/* 默认选中今天：实心圆高亮 */
							<span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground shadow-sm shadow-primary/20">
								{day.dayNumber}
							</span>
						) : (
							<span className="text-xs font-semibold text-muted-foreground/60">
								{day.dayNumber}
							</span>
						)}
					</div>
				))}

				{/* Habit rows */}
				{habits.map((habit) => {
					const habitChecked = checkedMap.get(habit.id) ?? new Set();
					return (
						<React.Fragment key={habit.id}>
							{/* Day circles */}
							{days.map((day) => {
								const checked = habitChecked.has(day.key);
								return (
									<button
										key={`${habit.id}-${day.key}`}
										type="button"
										onClick={() => onToggleDate(habit.id, day.key)}
										className={cn(
											"flex items-center justify-center py-1 transition-transform active:scale-90",
										)}
									>
										{checked ? (
											<span
												className={cn(
													"flex h-9 w-9 items-center justify-center rounded-full",
													"bg-primary text-primary-foreground",
													"shadow-sm shadow-primary/20",
													"transition-all duration-150",
												)}
											>
												<Check className="h-3.5 w-3.5" strokeWidth={2.5} />
											</span>
										) : (
											<span
												className={cn(
													"flex h-9 w-9 items-center justify-center rounded-full",
													"border border-muted-foreground/25",
													"bg-transparent",
													"transition-all duration-150",
													"hover:border-muted-foreground/50 hover:bg-muted/30",
												)}
											/>
										)}
									</button>
								);
							})}
						</React.Fragment>
					);
				})}
			</div>
		</div>
	);
}
