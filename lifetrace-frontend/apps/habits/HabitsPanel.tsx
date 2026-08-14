"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { HabitDetailPanel } from "@/apps/habits/components/HabitDetailPanel";
import { HabitStatsPanel } from "@/apps/habits/components/HabitStatsPanel";
import { AddHabitDialog } from "@/apps/habits/components/AddHabitDialog";
import { useHabits, type Habit } from "@/apps/habits/hooks/useHabits";
import { useFocusTarget } from "@/lib/store/focus-target-store";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
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
	const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const isMobile = useIsMobile();

	const handleSelectHabit = (habit: Habit) => {
		setSelectedHabit(habit);
		if (isMobile) setMobileDetailOpen(true);
	};

	// 从 agent 卡片「查看」跳转过来时，选中对应习惯
	const focusTarget = useFocusTarget((s) => s.target);
	const clearFocusTarget = useFocusTarget((s) => s.setTarget);
	useEffect(() => {
		if (!focusTarget || focusTarget.feature !== "habit") return;
		const found = habits.find((h) => String(h.id) === focusTarget.id);
		if (found) {
			setSelectedHabit(found);
			if (isMobile) setMobileDetailOpen(true);
			clearFocusTarget(null);
		}
	}, [focusTarget, habits, clearFocusTarget, isMobile]);

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
			{/* Left panel: stats + list（移动端全宽） */}
			<div
				style={{ flex: isMobile ? 1 : leftRatio }}
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

			{/* 桌面端：可拖拽分隔条 + 右侧详情 */}
			{!isMobile && (
				<>
					<ResizeHandle
						onPointerDown={handleResizePointerDown}
						isDragging={isDragging}
						isVisible={true}
					/>
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
				</>
			)}

			{/* 移动端：全屏详情 overlay */}
			{isMobile && mobileDetailOpen && selectedHabit && (
				<motion.div
					className="fixed inset-0 z-50 flex flex-col bg-background shadow-xl"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					transition={{ type: "spring", damping: 30, stiffness: 300 }}
				>
					<div className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5">
						<button
							type="button"
							onClick={() => setMobileDetailOpen(false)}
							className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50"
							aria-label={t("back")}
						>
							<ArrowLeft className="h-5 w-5" />
						</button>
						<span className="truncate text-sm font-medium">
							{selectedHabit.icon ? `${selectedHabit.icon} ` : ""}
							{selectedHabit.name}
						</span>
					</div>
					<div className="flex-1 overflow-hidden">
						<HabitDetailPanel
							habit={selectedHabit}
							records={records}
							onToggleDate={(date) => handleToggleDate(selectedHabit.id, date)}
						/>
					</div>
				</motion.div>
			)}

			{/* Add habit dialog */}
			<AddHabitDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onSave={handleAddHabit}
			/>
		</div>
	);
}
