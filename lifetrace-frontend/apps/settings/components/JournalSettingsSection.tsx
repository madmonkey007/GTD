"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useJournalStore } from "@/lib/store/journal-store";
import { SettingsSection } from "./SettingsSection";
import { ToggleSwitch } from "./ToggleSwitch";

/** 时光机 8 种固定风格的可视化预览（背景色 + 名称） */
const TIME_MACHINE_STYLES: { name: string; bg: string; fg: string; border: boolean }[] = [
	{ name: "文艺简约", bg: "#ffffff", fg: "#1a1816", border: true },
	{ name: "杂志", bg: "#1a1816", fg: "#f7f5f1", border: false },
	{ name: "暗色沉浸", bg: "#18181b", fg: "#f4f4f5", border: false },
	{ name: "手写便签", bg: "#f5edd6", fg: "#5a4a1a", border: false },
	{ name: "极简边框", bg: "#ffffff", fg: "#1a1816", border: true },
	{ name: "暖米渐变", bg: "#f0e8da", fg: "#1a1816", border: true },
	{ name: "居中语录", bg: "#2d5f5d", fg: "#ffffff", border: false },
	{ name: "时间轴", bg: "#ffffff", fg: "#1a1816", border: true },
];

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
		timeMachineStyleMode,
		timeMachineStyle,
		setRefreshMode,
		setFixedTime,
		setWorkHoursStart,
		setWorkHoursEnd,
		setCustomTime,
		setAutoLinkEnabled,
		setAutoGenerateObjectiveEnabled,
		setAutoGenerateAiEnabled,
		setTimeMachineStyleMode,
		setTimeMachineStyle,
	} = useJournalStore();

	const fixedId = useId();
	const workStartId = useId();
	const workEndId = useId();
	const customId = useId();
	const refreshModeId = useId();
	const autoLinkId = useId();
	const autoObjectiveId = useId();
	const autoAiId = useId();
	const styleModeId = useId();

	return (
		<>
			<SettingsSection
				title={tSettings("journalSettingsTitle")}
			description={tSettings("journalSettingsDescription")}
			searchKeywords={[
				tSettings("journalRefreshModeLabel"),
				tSettings("journalAutoLinkLabel"),
			]}
		>
			<div className="space-y-4">
				<div className="grid gap-3 md:grid-cols-2">
					<div className="space-y-1">
						<label
							htmlFor={refreshModeId}
							className="text-sm font-medium text-foreground"
						>
							{tSettings("journalRefreshModeLabel")}
						</label>
						<select
							id={refreshModeId}
							value={refreshMode}
							onChange={(event) =>
								setRefreshMode(
									event.target.value as typeof refreshMode,
								)
							}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
						>
							<option value="fixed">
								{tSettings("journalRefreshModeFixed")}
							</option>
							<option value="workHours">
								{tSettings("journalRefreshModeWorkHours")}
							</option>
							<option value="custom">
								{tSettings("journalRefreshModeCustom")}
							</option>
						</select>
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-3">
					<div className="space-y-1">
						<label
							htmlFor={fixedId}
							className="text-sm text-muted-foreground"
						>
							{tSettings("journalFixedTimeLabel")}
						</label>
						<input
							id={fixedId}
							type="time"
							value={fixedTime}
							onChange={(event) => setFixedTime(event.target.value)}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
						/>
					</div>
					<div className="space-y-1">
						<label
							htmlFor={workStartId}
							className="text-sm text-muted-foreground"
						>
							{tSettings("journalWorkHoursLabel")}
						</label>
						<div className="flex items-center gap-2">
							<input
								id={workStartId}
								type="time"
								value={workHoursStart}
								onChange={(event) =>
									setWorkHoursStart(event.target.value)
								}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
							/>
							<span className="text-xs text-muted-foreground">-</span>
							<input
								id={workEndId}
								type="time"
								value={workHoursEnd}
								onChange={(event) => setWorkHoursEnd(event.target.value)}
								className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
							/>
						</div>
					</div>
					<div className="space-y-1">
						<label
							htmlFor={customId}
							className="text-sm text-muted-foreground"
						>
							{tSettings("journalCustomTimeLabel")}
						</label>
						<input
							id={customId}
							type="time"
							value={customTime}
							onChange={(event) => setCustomTime(event.target.value)}
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
						/>
					</div>
				</div>

				<div className="grid gap-3">
					<div className="flex items-center justify-between">
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
					<div className="flex items-center justify-between">
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
					<div className="flex items-center justify-between">
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

		<SettingsSection
			title={tSettings("journalTimeMachineStyleTitle")}
			description={tSettings("journalTimeMachineStyleDescription")}
			searchKeywords={[
				tSettings("journalTimeMachineStyleTitle"),
				tSettings("journalTimeMachineStyleRandom"),
				tSettings("journalTimeMachineStyleFixed"),
			]}
		>
			<div className="space-y-4">
				{/* 随机 / 固定 */}
				<div className="flex flex-wrap items-center gap-4">
					<label
						htmlFor={styleModeId}
						className="text-sm font-medium text-foreground"
					>
						{tSettings("journalTimeMachineStyleModeLabel")}
					</label>
					<div className="flex items-center gap-4">
						<label className="flex items-center gap-2 text-sm text-foreground">
							<input
								type="radio"
								name="time-machine-style-mode"
								value="random"
								checked={timeMachineStyleMode === "random"}
								onChange={() => setTimeMachineStyleMode("random")}
								className="h-4 w-4 accent-[--primary]"
							/>
							{tSettings("journalTimeMachineStyleRandom")}
						</label>
						<label className="flex items-center gap-2 text-sm text-foreground">
							<input
								type="radio"
								name="time-machine-style-mode"
								value="fixed"
								checked={timeMachineStyleMode === "fixed"}
								onChange={() => setTimeMachineStyleMode("fixed")}
								className="h-4 w-4 accent-[--primary]"
							/>
							{tSettings("journalTimeMachineStyleFixed")}
						</label>
					</div>
				</div>

				{/* 固定样式时：8 种风格选择（带色块预览） */}
				{timeMachineStyleMode === "fixed" && (
					<div className="grid gap-2 sm:grid-cols-2">
						{TIME_MACHINE_STYLES.map((style, index) => (
							<button
								key={style.name}
								type="button"
								onClick={() => setTimeMachineStyle(index)}
								className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all active:scale-[0.98] ${
									timeMachineStyle === index
										? "border-primary ring-1 ring-primary/30"
										: "border-border hover:border-border/80 hover:bg-muted/30"
								}`}
							>
								<span
									className="h-6 w-6 shrink-0 rounded-md border border-black/10"
									style={{ backgroundColor: style.bg }}
								/>
								<span className="text-foreground">{style.name}</span>
							</button>
						))}
					</div>
				)}
			</div>
		</SettingsSection>
		</>
	);
}
