"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { HabitDetailPanel } from "@/apps/habits/components/HabitDetailPanel";
import { HabitStatsPanel } from "@/apps/habits/components/HabitStatsPanel";
import { AddHabitDialog } from "@/apps/habits/components/AddHabitDialog";
import { useHabits, type Habit } from "@/apps/habits/hooks/useHabits";
import { ResizeHandle } from "@/components/layout/ResizeHandle";

export function HabitsPanel() {
	const t = useTranslations("habits");
	const {
		habits,
		records,
		addHabit,
		removeHabit,
		toggleRecord,
	} = useHabits();
	const [selectedHabit, setSelectedHabit] = useState<Habit | null>(
		() => habits[0] ?? null,
	);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [leftRatio, setLeftRatio] = useState(0.6);
	const [isDragging, setIsDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleSelectHabit = (habit: Habit) => {
		setSelectedHabit(habit);
	};

	const handleToggleDate = (habitId: string, date: string) => {
		toggleRecord(habitId, date);
	};

	const handleAddHabit = (data: {
		name: string;
		icon: string;
		frequency: Habit["frequency"];
		goal: Habit["goal"];
		startDate: string;
		persistenceDays: number;
		group: Habit["group"];
	}) => {
		addHabit(data.name, {
			icon: data.icon,
			frequency: data.frequency,
			goal: data.goal,
			startDate: data.startDate,
			persistenceDays: data.persistenceDays,
			group: data.group,
		});
		setDialogOpen(false);
	};

	// When the selected habit is deleted, select another
	const handleDeleteHabit = (id: string) => {
		removeHabit(id);
		if (selectedHabit?.id === id) {
			const remaining = habits.filter((h) => h.id !== id);
			setSelectedHabit(remaining[0] ?? null);
		}
	};

	const handleResizePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();
			setIsDragging(true);

			const container = containerRef.current;
			if (!container) return;

			const rect = container.getBoundingClientRect();

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const ratio = (moveEvent.clientX - rect.left) / rect.width;
				setLeftRatio(Math.max(0.2, Math.min(0.8, ratio)));
			};

			const handlePointerUp = () => {
				setIsDragging(false);
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		},
		[],
	);

	return (
		<div ref={containerRef} className="flex h-full overflow-hidden bg-background">
			{/* Left panel: stats + list */}
			<div
				style={{ flex: leftRatio }}
				className="min-w-0 border-r border-border/40"
			>
				<HabitStatsPanel
					habits={habits}
					records={records}
					selectedHabitId={selectedHabit?.id ?? null}
					onSelectHabit={handleSelectHabit}
					onToggleDate={handleToggleDate}
					onAddClick={() => setDialogOpen(true)}
					onDeleteHabit={handleDeleteHabit}
				/>
			</div>

			{/* Draggable resize handle */}
			<ResizeHandle
				onPointerDown={handleResizePointerDown}
				isDragging={isDragging}
				isVisible={true}
			/>

			{/* Right panel: detail */}
			<div
				style={{ flex: 1 - leftRatio }}
				className="min-w-0"
			>
				{selectedHabit ? (
					<HabitDetailPanel
						habit={selectedHabit}
						records={records}
						onToggleDate={(date) => handleToggleDate(selectedHabit.id, date)}
					/>
				) : (
					<div className="flex h-full items-center justify-center">
						<p className="text-sm text-muted-foreground/40">
							{t("noHabitSelected")}
						</p>
					</div>
				)}
			</div>

			{/* Add habit dialog */}
			<AddHabitDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onSave={handleAddHabit}
			/>
		</div>
	);
}
