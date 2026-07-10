"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LayoutSelector } from "@/components/common/layout/LayoutSelector";
import { ThemeStyleSelect } from "@/components/common/theme/ThemeStyleSelect";
import { ThemeToggle } from "@/components/common/theme/ThemeToggle";
import { LanguageToggle } from "@/components/common/ui/LanguageToggle";
import { SettingsSection } from "./SettingsSection";

export function AppearanceSection() {
	const tSettings = useTranslations("page.settings");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	return (
		<SettingsSection
			title={tSettings("appearanceTitle")}
			description={tSettings("appearanceDescription")}
		>
			<div className="space-y-6">
				{/* 布局选择器 */}
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0 flex-1">
						<label className="text-sm font-medium text-foreground">
							{tSettings("layoutTitle")}
						</label>
						<p className="text-xs text-muted-foreground">
							{tSettings("layoutDescription")}
						</p>
					</div>
					<LayoutSelector showChevron showLabel />
				</div>

				{/* 分割线 */}
				<div className="border-t border-border" />

				{/* 配色风格 */}
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0 flex-1">
						<label className="text-sm font-medium text-foreground">
							{tSettings("colorThemeTitle")}
						</label>
						<p className="text-xs text-muted-foreground">
							{tSettings("colorThemeDescription")}
						</p>
					</div>
					<ThemeStyleSelect />
				</div>

				{/* 分割线 */}
				<div className="border-t border-border" />

				{/* 主题（亮色/深色/跟随系统） */}
				<div className="flex items-center justify-between">
					<div>
						<label className="text-sm font-medium text-foreground">
							{tSettings("themeTitle")}
						</label>
						<p className="text-xs text-muted-foreground">
							{tSettings("themeDescription")}
						</p>
					</div>
					<ThemeToggle />
				</div>

				{/* 分割线 */}
				<div className="border-t border-border" />

				{/* 语言 */}
				<div className="flex items-center justify-between">
					<div>
						<label className="text-sm font-medium text-foreground">
							{tSettings("languageTitle")}
						</label>
						<p className="text-xs text-muted-foreground">
							{tSettings("languageDescription")}
						</p>
					</div>
					<LanguageToggle />
				</div>
			</div>
		</SettingsSection>
	);
}
