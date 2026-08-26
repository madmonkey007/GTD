"use client";

import { useTranslations } from "next-intl";
import {
	DEFAULT_SHORTCUTS,
	QUICK_CAPTURE_SHORTCUT_OPTIONS,
	useQuickCapture,
	type QuickCaptureShortcut,
	type QuickCaptureType,
} from "@/lib/store/quick-capture-store";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

/** 快速记录快捷键设置：为记笔记/记待办/收集箱分别选择唤起组合键 */
export function ShortcutSettingsSection() {
	const t = useTranslations("page.settings");
	const shortcuts = useQuickCapture((s) => s.shortcuts);
	const setShortcut = useQuickCapture((s) => s.setShortcut);

	const rows: Array<{ type: QuickCaptureType; labelKey: string }> = [
		{ type: "note", labelKey: "shortcutNoteLabel" },
		{ type: "todo", labelKey: "shortcutTodoLabel" },
		{ type: "inbox", labelKey: "shortcutInboxLabel" },
	];

	// 一个组合键只能绑定一个类型：其余类型的当前值从可选项中排除
	const usedByOther = (type: QuickCaptureType, option: string) =>
		Object.entries(shortcuts).some(([k, v]) => k !== type && v === option);

	return (
		<SettingsSection
			title={t("shortcutTitle")}
			description={t("shortcutDescription")}
			searchKeywords={[t("shortcutTitle"), t("shortcutDescription")]}
		>
			<div className="flex flex-col gap-3">
				{rows.map(({ type, labelKey }) => (
					<div key={type} className="flex items-center justify-between gap-4">
						<span className="text-sm font-medium text-foreground">
							{t(labelKey)}
						</span>
						<select
							value={shortcuts[type]}
							onChange={(e) =>
								setShortcut(type, e.target.value as QuickCaptureShortcut)
							}
							className={cn(
								"h-8 rounded-lg border border-border/50 bg-background px-2 text-sm outline-none focus:border-primary/40",
								shortcuts[type] !== DEFAULT_SHORTCUTS[type] && "text-primary",
							)}
							aria-label={t(labelKey)}
						>
							{QUICK_CAPTURE_SHORTCUT_OPTIONS.map((option) => (
								<option
									key={option}
									value={option}
									disabled={usedByOther(type, option)}
								>
									{option}
									{usedByOther(type, option) ? ` (${t("shortcutInUse")})` : ""}
								</option>
							))}
						</select>
					</div>
				))}
			</div>
			<p className="text-xs text-muted-foreground">{t("shortcutHint")}</p>
		</SettingsSection>
	);
}
