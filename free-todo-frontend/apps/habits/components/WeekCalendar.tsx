"use client";

import { Check } from "lucide-react";
import React, { useMemo } from "react";
import type { Habit, HabitRecord } from "@/apps/habits/hooks/useHabits";
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

function buildLast7Days(): DayInfo[] {
	const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
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
	const days = useMemo(() => buildLast7Days(), []);

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
						<span
							className={cn(
								"text-xs font-semibold",
								day.isToday
									? "text-foreground"
									: "text-muted-foreground/60",
							)}
						>
							{day.dayNumber}
						</span>
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
													"flex h-7 w-7 items-center justify-center rounded-full",
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
													"flex h-7 w-7 items-center justify-center rounded-full",
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

				{/* Empty state */}
				{habits.length === 0 && (
					<div className="col-span-7 flex items-center justify-center py-4">
						<span className="text-xs text-muted-foreground/40">
							暂无习惯
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
