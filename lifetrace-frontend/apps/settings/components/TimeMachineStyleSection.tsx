"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useJournalStore } from "@/lib/store/journal-store";
import { SettingsSection } from "./SettingsSection";

/** 时光机 8 种固定风格的可视化预览（背景色 + 名称） */
const TIME_MACHINE_STYLES: { name: string; bg: string }[] = [
	{ name: "文艺简约", bg: "#ffffff" },
	{ name: "杂志", bg: "#1a1816" },
	{ name: "暗色沉浸", bg: "#18181b" },
	{ name: "手写便签", bg: "#f5edd6" },
	{ name: "极简边框", bg: "#ffffff" },
	{ name: "暖米渐变", bg: "#f0e8da" },
	{ name: "居中语录", bg: "#2d5f5d" },
	{ name: "时间轴", bg: "#ffffff" },
];

/** 时光机卡片样式设置区块（挂在「工作区与面板」分类下） */
export function TimeMachineStyleSection() {
	const tSettings = useTranslations("page.settings");
	const {
		timeMachineStyleMode,
		timeMachineStyle,
		setTimeMachineStyleMode,
		setTimeMachineStyle,
	} = useJournalStore();

	const styleModeId = useId();

	return (
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
	);
}
