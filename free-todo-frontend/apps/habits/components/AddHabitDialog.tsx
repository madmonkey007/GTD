"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DEFAULT_HABIT_ICONS } from "@/apps/habits/hooks/useHabits";
import type { Habit } from "@/apps/habits/hooks/useHabits";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AddHabitDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (data: {
		name: string;
		icon: string;
		frequency: Habit["frequency"];
		goal: Habit["goal"];
		startDate: string;
		persistenceDays: number;
		group: Habit["group"];
	}) => void;
}

const fieldVariants = {
	hidden: { opacity: 0, y: 12 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: {
			type: "spring" as const,
			stiffness: 280,
			damping: 24,
			mass: 0.8,
			delay: i * 0.04,
		},
	}),
};

export function AddHabitDialog({
	open,
	onOpenChange,
	onSave,
}: AddHabitDialogProps) {
	const t = useTranslations("habits");

	const [name, setName] = useState("");
	const [icon, setIcon] = useState(DEFAULT_HABIT_ICONS[0]);
		const [iconExpanded, setIconExpanded] = useState(false);
	const [frequency, setFrequency] = useState<Habit["frequency"]>("daily");
	const [goal, setGoal] = useState<Habit["goal"]>("complete");
	const [startDate, setStartDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [persistenceDays, setPersistenceDays] = useState(0);
	const [group, setGroup] = useState<Habit["group"]>("allDay");

	const resetForm = () => {
		setName("");
		setIcon(DEFAULT_HABIT_ICONS[0]);
		setIconExpanded(false);
		setFrequency("daily");
		setGoal("complete");
		setStartDate(new Date().toISOString().slice(0, 10));
		setPersistenceDays(0);
		setGroup("allDay");
	};

	const handleSave = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		onSave({
			name: trimmed,
			icon,
			frequency,
			goal,
			startDate,
			persistenceDays,
			group,
		});
		resetForm();
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) resetForm();
		onOpenChange(newOpen);
	};

	const FREQUENCY_OPTIONS: { value: Habit["frequency"]; label: string }[] = [
		{ value: "daily", label: t("frequencyDaily") },
		{ value: "weekly", label: t("frequencyWeekly") },
		{ value: "monthly", label: t("frequencyMonthly") },
	];

	const GOAL_OPTIONS: { value: Habit["goal"]; label: string }[] = [
		{ value: "complete", label: t("goalComplete") },
		{ value: "participate", label: t("goalParticipate") },
	];

	const PERSISTENCE_OPTIONS: { value: number; label: string }[] = [
		{ value: 0, label: t("persistenceForever") },
		{ value: 7, label: t("persistenceDaysValue", { days: 7 }) },
		{ value: 21, label: t("persistenceDaysValue", { days: 21 }) },
		{ value: 30, label: t("persistenceDaysValue", { days: 30 }) },
		{ value: 100, label: t("persistenceDaysValue", { days: 100 }) },
		{ value: 365, label: t("persistenceDaysValue", { days: 365 }) },
	];

	const GROUP_OPTIONS: { value: Habit["group"]; label: string }[] = [
		{ value: "morning", label: t("groupMorning") },
		{ value: "afternoon", label: t("groupAfternoon") },
		{ value: "evening", label: t("groupEvening") },
		{ value: "allDay", label: t("groupAllDay") },
	];

	const isValid = name.trim().length > 0;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className={cn(
					"sm:max-w-lg p-0 gap-0 overflow-hidden",
					"rounded-2xl border-border/60",
					"shadow-2xl shadow-black/5",
				)}
			>
				{/* Glass refraction accent */}
				<div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none" />

				<DialogHeader className="px-6 pt-6 pb-1">
					<DialogTitle className="text-base font-semibold tracking-tight">
						{t("addHabitTitle")}
					</DialogTitle>
				</DialogHeader>

				<div className="px-6 py-3 space-y-5">
					{/* Habit name */}
					<motion.div
						custom={0}
						initial="hidden"
						animate="visible"
						variants={fieldVariants}
					>
						<label className="mb-1.5 block text-[11px] font-medium text-muted-foreground/70 tracking-wider uppercase">
							{t("habitName")}
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("habitNamePlaceholder")}
							className={cn(
								"w-full rounded-xl border border-border/60 bg-muted/30",
								"px-4 py-2.5 text-sm outline-none",
								"transition-all duration-200",
								"placeholder:text-muted-foreground/25",
								"focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20",
								"shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
								"focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
							)}
							autoFocus
						/>
					</motion.div>

					{/* Emoji icon picker */}
					<motion.div
						custom={1}
						initial="hidden"
						animate="visible"
						variants={fieldVariants}
					>
						<label className="mb-2 block text-[11px] font-medium text-muted-foreground/70 tracking-wider uppercase">
							{t("iconLabel")}
						</label>
							<button
								type="button"
								onClick={() => setIconExpanded(!iconExpanded)}
								className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm transition-all duration-200 hover:bg-muted/50"
							>
								<span className="text-lg">{icon}</span>
								<span className="text-muted-foreground/60">{iconExpanded ? t("iconCollapse") : t("iconChoose")}</span>
							</button>
							{iconExpanded && (
								<div className="mt-2 grid grid-cols-10 gap-1.5">
									{DEFAULT_HABIT_ICONS.map((e) => (
										<button
											key={e}
											type="button"
											onClick={() => { setIcon(e); setIconExpanded(false); }}
											className={cn(
												"flex h-8 w-8 items-center justify-center rounded-lg text-base",
												"transition-all duration-150",
												icon === e
													? "bg-primary text-primary-foreground scale-105 shadow-[0_0_0_1px_oklch(var(--primary))]"
													: "text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground hover:scale-105",
											)}
										>
											{e}
										</button>
									))}
								</div>
							)}
					</motion.div>

					{/* Two-column grid for selects */}
					<div className="grid grid-cols-2 gap-4">
						<motion.div
							custom={2}
							initial="hidden"
							animate="visible"
							variants={fieldVariants}
							className="space-y-1.5"
						>
							<label className="text-[11px] font-medium text-muted-foreground/70 tracking-wider uppercase">
								{t("frequency")}
							</label>
							<select
								value={frequency}
								onChange={(e) =>
									setFrequency(e.target.value as Habit["frequency"])
								}
								className={cn(
									"w-full rounded-xl border border-border/60 bg-muted/30",
									"px-3.5 py-2.5 text-sm outline-none",
									"transition-all duration-200",
									"focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20",
									"shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
								)}
							>
								{FREQUENCY_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</motion.div>

						<motion.div
							custom={3}
							initial="hidden"
							animate="visible"
							variants={fieldVariants}
							className="space-y-1.5"
						>
							<label className="text-[11px] font-medium text-muted-foreground/70 tracking-wider uppercase">
								{t("goal")}
							</label>
							<select
								value={goal}
								onChange={(e) =>
									setGoal(e.target.value as Habit["goal"])
								}
								className={cn(
									"w-full rounded-xl border border-border/60 bg-muted/30",
									"px-3.5 py-2.5 text-sm outline-none",
									"transition-all duration-200",
									"focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20",
									"shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
								)}
							>
								{GOAL_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</motion.div>

						<motion.div
							custom={4}
							initial="hidden"
							animate="visible"
							variants={fieldVariants}
							className="space-y-1.5"
						>
							<label className="text-[11px] font-medium text-muted-foreground/70 tracking-wider uppercase">
								{t("startDate")}
							</label>
							<input
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								className={cn(
									"w-full rounded-xl border border-border/60 bg-muted/30",
									"px-3.5 py-2.5 text-sm outline-none",
									"transition-all duration-200",
									"focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20",
									"shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
									"focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
								)}
							/>
						</motion.div>

						<motion.div
							custom={5}
							initial="hidden"
							animate="visible"
							variants={fieldVariants}
							className="space-y-1.5"
						>
							<label className="text-[11px] font-medium text-muted-foreground/70 tracking-wider uppercase">
								{t("persistenceDays")}
							</label>
							<select
								value={persistenceDays}
								onChange={(e) =>
									setPersistenceDays(Number(e.target.value))
								}
								className={cn(
									"w-full rounded-xl border border-border/60 bg-muted/30",
									"px-3.5 py-2.5 text-sm outline-none",
									"transition-all duration-200",
									"focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20",
									"shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
								)}
							>
								{PERSISTENCE_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</motion.div>
					</div>

					{/* Group - full width */}
					<motion.div
						custom={6}
						initial="hidden"
						animate="visible"
						variants={fieldVariants}
						className="space-y-1.5"
					>
						<label className="text-[11px] font-medium text-muted-foreground/70 tracking-wider uppercase">
							{t("group")}
						</label>
						<select
							value={group}
							onChange={(e) =>
								setGroup(e.target.value as Habit["group"])
							}
							className={cn(
								"w-full rounded-xl border border-border/60 bg-muted/30",
								"px-3.5 py-2.5 text-sm outline-none",
								"transition-all duration-200",
								"focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20",
								"shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
							)}
						>
							{GROUP_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</motion.div>
				</div>

				<DialogFooter
					className={cn(
						"px-6 py-4 mt-2",
						"border-t border-border/40",
						"bg-muted/10",
					)}
				>
					<button
						type="button"
						onClick={() => handleOpenChange(false)}
						className={cn(
							"rounded-xl px-5 py-2.5 text-sm font-medium",
							"text-muted-foreground/70",
							"transition-all duration-150",
							"hover:bg-muted/50 hover:text-foreground",
							"active:scale-[0.97]",
						)}
					>
						{t("cancel")}
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!isValid}
						className={cn(
							"rounded-xl px-5 py-2.5 text-sm font-medium",
							"transition-all duration-150",
							"active:scale-[0.97]",
							isValid
								? "bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 hover:brightness-110"
								: "bg-muted text-muted-foreground/40 cursor-not-allowed",
						)}
					>
						{t("save")}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
