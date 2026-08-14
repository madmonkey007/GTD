"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useJournalStore } from "@/lib/store/journal-store";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "./SegmentedControl";
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

/** 时光机卡片样式设置区块（挂在「外观与工作区」分类下） */
export function TimeMachineStyleSection() {
	const tSettings = useTranslations("page.settings");
	const [stylePickerOpen, setStylePickerOpen] = useState(false);
	const {
		timeMachineStyleMode,
		timeMachineStyle,
		setTimeMachineStyleMode,
		setTimeMachineStyle,
	} = useJournalStore();

	const currentStyle = TIME_MACHINE_STYLES[timeMachineStyle] ?? TIME_MACHINE_STYLES[0];

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
				<div className="flex items-center justify-between gap-4">
					<span className="text-sm font-medium text-foreground">
						{tSettings("journalTimeMachineStyleModeLabel")}
					</span>
					<SegmentedControl
						options={[
							{
								value: "random",
								label: tSettings("journalTimeMachineStyleRandom"),
							},
							{
								value: "fixed",
								label: tSettings("journalTimeMachineStyleFixed"),
							},
						]}
						value={timeMachineStyleMode}
						onChange={setTimeMachineStyleMode}
						ariaLabel={tSettings("journalTimeMachineStyleModeLabel")}
					/>
				</div>

				{/* 固定样式时：默认收起，只显示当前选择；点击展开切换 */}
				{timeMachineStyleMode === "fixed" && (
					<div className="space-y-2">
						<button
							type="button"
							onClick={() => setStylePickerOpen((prev) => !prev)}
							aria-expanded={stylePickerOpen}
							className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
						>
							<span className="flex min-w-0 items-center gap-3">
								<span
									className="h-6 w-6 shrink-0 rounded-md border border-black/10"
									style={{ backgroundColor: currentStyle.bg }}
								/>
								<span className="truncate text-foreground">
									{currentStyle.name}
								</span>
							</span>
							<ChevronDown
								className={cn(
									"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
									stylePickerOpen && "rotate-180",
								)}
							/>
						</button>

						{stylePickerOpen && (
							<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
								{TIME_MACHINE_STYLES.map((style, index) => (
									<button
										key={style.name}
										type="button"
										onClick={() => {
											setTimeMachineStyle(index);
											setStylePickerOpen(false);
										}}
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
										<span className="truncate text-foreground">
											{style.name}
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</SettingsSection>
	);
}
