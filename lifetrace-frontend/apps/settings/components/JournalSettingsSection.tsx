"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import {
	type JournalRefreshMode,
	useJournalStore,
} from "@/lib/store/journal-store";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "./SegmentedControl";
import { SettingsSection } from "./SettingsSection";
import { ToggleSwitch } from "./ToggleSwitch";

export function JournalSettingsSection() {
	const tSettings = useTranslations("page.settings");
	const {
		refreshMode,
		fixedTime,
		workHoursStart,
		workHoursEnd,
		customTime,
		autoLinkEnabled,
		autoGenerateObjectiveEnabled,
		autoGenerateAiEnabled,
		setRefreshMode,
		setFixedTime,
		setWorkHoursStart,
		setWorkHoursEnd,
		setCustomTime,
		setAutoLinkEnabled,
		setAutoGenerateObjectiveEnabled,
		setAutoGenerateAiEnabled,
	} = useJournalStore();

	const fixedId = useId();
	const workStartId = useId();
	const workEndId = useId();
	const customId = useId();
	const autoLinkId = useId();
	const autoObjectiveId = useId();
	const autoAiId = useId();

	const timeInputCls =
		"rounded-md border border-border bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

	const modeOptions: { value: JournalRefreshMode; label: string }[] = [
		{ value: "fixed", label: tSettings("journalRefreshModeFixed") },
		{ value: "workHours", label: tSettings("journalRefreshModeWorkHours") },
		{ value: "custom", label: tSettings("journalRefreshModeCustom") },
	];

	return (
		<SettingsSection
			title={tSettings("journalSettingsTitle")}
			description={tSettings("journalSettingsDescription")}
			searchKeywords={[
				tSettings("journalRefreshModeLabel"),
				tSettings("journalAutoLinkLabel"),
			]}
		>
			<div className="space-y-4">
				{/* 刷新模式 */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<label className="text-sm font-medium text-foreground">
						{tSettings("journalRefreshModeLabel")}
					</label>
					<SegmentedControl
						options={modeOptions}
						value={refreshMode}
						onChange={setRefreshMode}
						ariaLabel={tSettings("journalRefreshModeLabel")}
					/>
				</div>

				{/* 时间字段：按刷新模式只显示相关输入 */}
				{refreshMode === "fixed" && (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<label
							htmlFor={fixedId}
							className="text-sm font-medium text-foreground"
						>
							{tSettings("journalFixedTimeLabel")}
						</label>
						<input
							id={fixedId}
							type="time"
							value={fixedTime}
							onChange={(event) => setFixedTime(event.target.value)}
							className={cn(timeInputCls, "w-full sm:w-40")}
						/>
					</div>
				)}

				{refreshMode === "workHours" && (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<label
							htmlFor={workStartId}
							className="text-sm font-medium text-foreground"
						>
							{tSettings("journalWorkHoursLabel")}
						</label>
						<div className="flex min-w-0 items-center gap-2">
							<input
								id={workStartId}
								type="time"
								value={workHoursStart}
								onChange={(event) => setWorkHoursStart(event.target.value)}
								className={cn(timeInputCls, "min-w-0 flex-1 sm:w-36 sm:flex-none")}
							/>
							<span className="shrink-0 text-xs text-muted-foreground">-</span>
							<input
								id={workEndId}
								type="time"
								value={workHoursEnd}
								onChange={(event) => setWorkHoursEnd(event.target.value)}
								className={cn(timeInputCls, "min-w-0 flex-1 sm:w-36 sm:flex-none")}
							/>
						</div>
					</div>
				)}

				{refreshMode === "custom" && (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<label
							htmlFor={customId}
							className="text-sm font-medium text-foreground"
						>
							{tSettings("journalCustomTimeLabel")}
						</label>
						<input
							id={customId}
							type="time"
							value={customTime}
							onChange={(event) => setCustomTime(event.target.value)}
							className={cn(timeInputCls, "w-full sm:w-40")}
						/>
					</div>
				)}

				<div className="border-t border-border/60" />

				{/* 自动生成策略 */}
				<div className="space-y-3">
					<div className="flex items-center justify-between gap-4">
						<label
							htmlFor={autoLinkId}
							className="text-sm font-medium text-foreground"
						>
							{tSettings("journalAutoLinkLabel")}
						</label>
						<ToggleSwitch
							id={autoLinkId}
							enabled={autoLinkEnabled}
							onToggle={setAutoLinkEnabled}
							ariaLabel={tSettings("journalAutoLinkLabel")}
						/>
					</div>
					<div className="flex items-center justify-between gap-4">
						<label
							htmlFor={autoObjectiveId}
							className="text-sm font-medium text-foreground"
						>
							{tSettings("journalAutoObjectiveLabel")}
						</label>
						<ToggleSwitch
							id={autoObjectiveId}
							enabled={autoGenerateObjectiveEnabled}
							onToggle={setAutoGenerateObjectiveEnabled}
							ariaLabel={tSettings("journalAutoObjectiveLabel")}
						/>
					</div>
					<div className="flex items-center justify-between gap-4">
						<label
							htmlFor={autoAiId}
							className="text-sm font-medium text-foreground"
						>
							{tSettings("journalAutoAiLabel")}
						</label>
						<ToggleSwitch
							id={autoAiId}
							enabled={autoGenerateAiEnabled}
							onToggle={setAutoGenerateAiEnabled}
							ariaLabel={tSettings("journalAutoAiLabel")}
						/>
					</div>
				</div>
			</div>
		</SettingsSection>
	);
}
