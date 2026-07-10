"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Habit, HabitRecord } from "@/apps/habits/hooks/useHabits";
import {
	calcMonthlyRate,
	calcStreak,
	countAllRecords,
	countMonthlyRecords,
	countTotalRecords,
} from "@/apps/habits/hooks/useHabits";
import { cn } from "@/lib/utils";

interface CalendarDay {
	date: Date;
	inCurrentMonth: boolean;
	isToday: boolean;
}

function toDateKey(date: Date): string {
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, "0");
	const d = `${date.getDate()}`.padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function buildMonthDays(year: number, month: number): CalendarDay[] {
	const todayKey = toDateKey(new Date());
	const firstDay = new Date(year, month, 1);
	const startDay = firstDay.getDay(); // 0=Sun
	// Start from Sunday of the first week
	const gridStart = new Date(year, month, 1 - startDay);

	return Array.from({ length: 42 }, (_, i) => {
		const date = new Date(gridStart);
		date.setDate(date.getDate() + i);
		return {
			date,
			inCurrentMonth: date.getMonth() === month,
			isToday: toDateKey(date) === todayKey,
		};
	});
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

interface HabitDetailPanelProps {
	habit: Habit;
	records: HabitRecord[];
	onToggleDate: (date: string) => void;
}

export function HabitDetailPanel({
	habit,
	records,
	onToggleDate,
}: HabitDetailPanelProps) {
	const t = useTranslations("habits");
	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState(new Date().getMonth());

	const monthDays = useMemo(() => buildMonthDays(year, month), [year, month]);

	const habitRecords = useMemo(
		() => records.filter((r) => r.habitId === habit.id),
		[records, habit.id],
	);
	const checkedDates = useMemo(
		() => new Set(habitRecords.map((r) => r.date)),
		[habitRecords],
	);

	const stats = useMemo(
		() => ({
			allCount: countAllRecords(records, habit.id),
			monthlyDays: countMonthlyRecords(records, habit.id, year, month + 1),
			totalDays: countTotalRecords(records, habit.id),
			rate: calcMonthlyRate(records, habit.id, year, month + 1),
			streak: calcStreak(records, habit.id),
		}),
		[records, habit.id, year, month],
	);

	const goPrevMonth = () => {
		if (month === 0) {
			setYear(year - 1);
			setMonth(11);
		} else {
			setMonth(month - 1);
		}
	};

	const goNextMonth = () => {
		if (month === 11) {
			setYear(year + 1);
			setMonth(0);
		} else {
			setMonth(month + 1);
		}
	};

	const handleDayClick = (day: CalendarDay) => {
		if (!day.inCurrentMonth) return;
		const key = toDateKey(day.date);
		onToggleDate(key);
	};

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
				<h2 className="text-sm font-semibold truncate">{habit.name}</h2>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
				{/* Stats */}
				<div className="grid grid-cols-5 gap-2">
					<StatCard
						label={t("statsRecords")}
						value={stats.allCount}
						unit={t("unitCount")}
					/>
					<StatCard
						label={t("statsMonthly")}
						value={stats.monthlyDays}
						unit={t("unitDay")}
					/>
					<StatCard
						label={t("statsTotal")}
						value={stats.totalDays}
						unit={t("unitDay")}
					/>
					<StatCard
						label={t("statsRate")}
						value={stats.rate}
						unit={t("unitPercent")}
					/>
					<StatCard
						label={t("statsStreak")}
						value={stats.streak}
						unit={t("unitDay")}
					/>
				</div>

				{/* Calendar */}
				<div className="rounded-xl border border-border/40 bg-muted/5 p-3">
					<div className="flex items-center justify-between mb-2">
						<button
							type="button"
							onClick={goPrevMonth}
							className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<span className="text-sm font-medium">
							{year}{t("yearLabel")}{month + 1}{t("monthLabel")}
						</span>
						<button
							type="button"
							onClick={goNextMonth}
							className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>

					{/* Weekday header */}
					<div className="grid grid-cols-7 mb-1">
						{WEEKDAY_LABELS.map((label, i) => (
							<span
								key={label}
								className={cn(
									"py-1 text-center text-xs font-medium",
									i >= 6
										? "text-muted-foreground/70"
										: "text-muted-foreground",
								)}
							>
								{label}
							</span>
						))}
					</div>

					{/* Day grid */}
					<div className="grid grid-cols-7 gap-0.5">
						{monthDays.map((day, idx) => {
							const key = toDateKey(day.date);
							const checked = checkedDates.has(key);
							const isWeekend = (idx % 7) >= 5;

							return (
								<button
									key={key}
									type="button"
									onClick={() => handleDayClick(day)}
									disabled={!day.inCurrentMonth}
									className={cn(
										"relative flex items-center justify-center rounded-lg py-2 text-sm font-medium transition-colors",
										!day.inCurrentMonth && "opacity-20",
										day.inCurrentMonth && !checked && "hover:bg-muted/50",
										checked &&
											"bg-primary text-primary-foreground",
										day.isToday && !checked &&
											"ring-1 ring-primary/40",
									)}
								>
									{checked ? (
										<Check className="h-4 w-4" />
									) : (
										<span
											className={cn(
												isWeekend &&
													day.inCurrentMonth &&
													"text-muted-foreground/70",
											)}
										>
											{day.date.getDate()}
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}


function StatCard({
	label,
	value,
	unit,
}: {
	label: string;
	value: number;
	unit: string;
}) {
	return (
		<div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/5 border border-border/30 px-2 py-3">
			<span className="text-lg font-bold tabular-nums text-foreground">
				{value}
				<span className="text-xs font-normal text-muted-foreground ml-0.5">
					{unit}
				</span>
			</span>
			<span className="text-[10px] text-muted-foreground/60 text-center leading-tight">
				{label}
			</span>
		</div>
	);
}
