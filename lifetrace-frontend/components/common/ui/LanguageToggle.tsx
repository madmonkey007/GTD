"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { type Locale, useLocaleStore } from "@/lib/store/locale";

export function LanguageToggle({ variant = "icon" }: { variant?: "icon" | "pill" }) {
	const { locale, setLocale } = useLocaleStore();
	const [mounted, setMounted] = useState(false);
	const router = useRouter();
	const tLang = useTranslations("language");
	const tLayout = useTranslations("layout");

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div className={variant === "pill" ? "h-9 w-20" : "h-9 w-9"} />;
	}

	const languages: { value: Locale; label: string }[] = [
		{ value: "zh", label: tLang("zh") },
		{ value: "en", label: tLang("en") },
	];

	const handleToggle = () => {
		const currentIndex = languages.findIndex((l) => l.value === locale);
		const nextIndex = (currentIndex + 1) % languages.length;
		const newLocale = languages[nextIndex].value;
		setLocale(newLocale);
		// 使用 router.refresh() 重新获取服务端数据，无白屏闪烁
		router.refresh();
	};

	const currentLanguage = languages.find((l) => l.value === locale);
	const label = `${tLayout("currentLanguage")}: ${currentLanguage?.label}`;

	if (variant === "pill") {
		return (
			<button
				type="button"
				onClick={handleToggle}
				className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				title={label}
				aria-label={label}
			>
				<Languages className="h-3.5 w-3.5" />
				{currentLanguage?.label}
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={handleToggle}
			className="rounded-md p-2 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground hover:shadow-md active:scale-95 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			title={label}
			aria-label={label}
		>
			<Languages className="h-5 w-5" />
		</button>
	);
}
