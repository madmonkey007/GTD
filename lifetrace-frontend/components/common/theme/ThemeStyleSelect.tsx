"use client";

import { Check, ChevronDown, Paintbrush } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { type ColorTheme, useColorThemeStore } from "@/lib/store/color-theme";
import { cn } from "@/lib/utils";

export function ThemeStyleSelect({
	showLabel = false,
}: {
	/** 显示当前主题名称 + 下拉箭头（用于设置页等需要展示当前值的场景） */
	showLabel?: boolean;
}) {
	const { colorTheme, setColorTheme } = useColorThemeStore();
	const t = useTranslations("colorTheme");
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);
	const wrapperRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const handleClickOutside = (event: MouseEvent) => {
			if (!wrapperRef.current) return;
			if (wrapperRef.current.contains(event.target as Node)) return;
			setOpen(false);
		};
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [open]);

	if (!mounted) {
		return <div className="h-9 w-9" />;
	}

	const options: { value: ColorTheme; label: string }[] = [
		{ value: "catppuccin", label: t("catppuccin") },
		{ value: "blue", label: t("blue") },
		{ value: "neutral", label: t("neutral") },
	];

	const currentOption = options.find((option) => option.value === colorTheme);

	return (
		<div className="relative" ref={wrapperRef}>
			<span className="sr-only">{t("label")}</span>
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className={cn(
					"transition-all duration-200 active:scale-95",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					showLabel
						? "flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
						: "flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-md active:shadow-sm",
				)}
				aria-haspopup="listbox"
				aria-expanded={open}
				title={t("label")}
				aria-label={t("label")}
			>
				{showLabel ? (
					<>
						<Paintbrush className="h-4 w-4 text-muted-foreground" />
						<span className="max-w-28 truncate">{currentOption?.label}</span>
						<ChevronDown
							className={cn(
								"h-3.5 w-3.5 text-muted-foreground transition-transform",
								open && "rotate-180",
							)}
						/>
					</>
				) : (
					<Paintbrush className="h-5 w-5" />
				)}
			</button>
			{open && (
				<div
					className="absolute right-0 z-30 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
					role="listbox"
				>
					{options.map((option) => {
						const isActive = option.value === colorTheme;
						return (
							<button
								key={option.value}
								type="button"
								role="option"
								aria-selected={isActive}
								onClick={() => {
									setColorTheme(option.value);
									setOpen(false);
								}}
								className={cn(
									"flex w-full items-center justify-between px-3 py-2 text-sm transition-colors",
									isActive
										? "bg-foreground/5 text-foreground"
										: "text-foreground hover:bg-foreground/5",
								)}
							>
								<span>{option.label}</span>
								{isActive && <Check className="h-4 w-4 text-primary" />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
