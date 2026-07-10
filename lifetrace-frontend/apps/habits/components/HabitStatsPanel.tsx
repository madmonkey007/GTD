"use client";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Habit, HabitRecord } from "@/apps/habits/hooks/useHabits";
import {
	calcStreak,
	countRecentRecords,
} from "@/apps/habits/hooks/useHabits";
import { WeekCalendar } from "@/apps/habits/components/WeekCalendar";
import { cn } from "@/lib/utils";

interface HabitStatsPanelProps {
	habits: Habit[];
	records: HabitRecord[];
	selectedHabitId: string | null;
	onSelectHabit: (habit: Habit) => void;
	onToggleDate: (habitId: string, date: string) => void;
	onAddClick: () => void;
	onDeleteHabit: (id: string) => void;
}

export function HabitStatsPanel({
	habits,
	records,
	selectedHabitId,
	onSelectHabit,
	onToggleDate,
	onAddClick,
	onDeleteHabit,
}: HabitStatsPanelProps) {
	const t = useTranslations("habits");

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
				<h2 className="text-sm font-semibold">{t("statsTitle")}</h2>
				<button
					type="button"
					onClick={onAddClick}
					className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
				{/* 7-day calendar for all habits */}
				{habits.length > 0 && (
					<section className="space-y-2">
						<h3 className="text-xs font-medium text-muted-foreground">
							{t("recentDays")}
						</h3>
						<WeekCalendar
							habits={habits}
							records={records}
							onToggleDate={onToggleDate}
						/>
					</section>
				)}

				{/* Habit cards */}
				<section className="space-y-2">
					{habits.length === 0 && (
						<div className="flex h-32 items-center justify-center">
							<p className="text-sm text-muted-foreground/40">
								{t("empty")}
							</p>
						</div>
					)}
					<div className="space-y-1.5">
						{habits.map((habit) => {
							const isSelected = habit.id === selectedHabitId;
							const streak = calcStreak(records, habit.id);
							const weeklyCount = countRecentRecords(records, habit.id, 7);
							return (
								<div
									key={habit.id}
									className={cn(
										"group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors cursor-pointer",
										isSelected
											? "border-primary/40 bg-primary/5"
											: "border-border/40 bg-muted/5 hover:border-border/70 hover:bg-muted/10",
									)}
									onClick={() => onSelectHabit(habit)}
								>
									<span className="text-lg shrink-0">{habit.icon}</span>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium truncate">
											{habit.name}
										</div>
										<div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
											<span>
												{streak}
												{t("unitDay")}
											</span>
											<span>·</span>
											<span>
												{t("weeklyCount", { count: weeklyCount })}
											</span>
										</div>
									</div>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteHabit(habit.id);
										}}
										className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
										title={t("delete")}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</button>
								</div>
							);
						})}
					</div>
				</section>
			</div>
		</div>
	);
}
