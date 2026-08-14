"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ThemeStyleSelect } from "@/components/common/theme/ThemeStyleSelect";
import { useLocaleStore } from "@/lib/store/locale";
import { SegmentedControl } from "./SegmentedControl";
import { SettingsSection } from "./SettingsSection";

const THEME_VALUES = ["light", "dark", "system"] as const;
type ThemeValue = (typeof THEME_VALUES)[number];

const LOCALE_VALUES = ["zh", "en"] as const;
type LocaleValue = (typeof LOCALE_VALUES)[number];

export function AppearanceSection() {
	const tSettings = useTranslations("page.settings");
	const tTheme = useTranslations("theme");
	const tLang = useTranslations("language");
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme } = useTheme();
	const { locale, setLocale } = useLocaleStore();
	const router = useRouter();

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	const themeOptions: { value: ThemeValue; label: string }[] = [
		{ value: "light", label: tTheme("light") },
		{ value: "dark", label: tTheme("dark") },
		{ value: "system", label: tTheme("system") },
	];
	const currentTheme: ThemeValue = theme && THEME_VALUES.includes(theme as ThemeValue)
		? (theme as ThemeValue)
		: "system";

	const localeOptions: { value: LocaleValue; label: string }[] = [
		{ value: "zh", label: tLang("zh") },
		{ value: "en", label: tLang("en") },
	];

	const handleLocaleChange = (value: LocaleValue) => {
		setLocale(value);
		// 使用 router.refresh() 重新获取服务端数据，无白屏闪烁
		router.refresh();
	};

	return (
		<SettingsSection
			title={tSettings("appearanceTitle")}
			description={tSettings("appearanceDescription")}
		>
			<div className="space-y-4">
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
					<ThemeStyleSelect showLabel />
				</div>

				{/* 分割线 */}
				<div className="border-t border-border/60" />

				{/* 主题（亮色/深色/跟随系统） */}
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0 flex-1">
						<label className="text-sm font-medium text-foreground">
							{tSettings("themeTitle")}
						</label>
						<p className="text-xs text-muted-foreground">
							{tSettings("themeDescription")}
						</p>
					</div>
					<SegmentedControl
						options={themeOptions}
						value={currentTheme}
						onChange={(value) => setTheme(value)}
						ariaLabel={tSettings("themeTitle")}
					/>
				</div>

				{/* 分割线 */}
				<div className="border-t border-border/60" />

				{/* 语言 */}
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0 flex-1">
						<label className="text-sm font-medium text-foreground">
							{tSettings("languageTitle")}
						</label>
						<p className="text-xs text-muted-foreground">
							{tSettings("languageDescription")}
						</p>
					</div>
					<SegmentedControl
						options={localeOptions}
						value={locale}
						onChange={handleLocaleChange}
						ariaLabel={tSettings("languageTitle")}
					/>
				</div>
			</div>
		</SettingsSection>
	);
}
