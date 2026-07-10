"use client";

import { Clock, List, Shuffle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DiaryFilterMode } from "@/apps/diary/hooks/useDiaryStats";
import { cn } from "@/lib/utils";

interface DiaryFilterBarProps {
	filterMode: DiaryFilterMode;
	onFilterModeChange: (mode: DiaryFilterMode) => void;
}

const FILTERS: { key: DiaryFilterMode; disabled?: boolean; icon: React.FC<{ className?: string }> }[] = [
	{ key: "all", icon: List },
	{ key: "last7", icon: Clock },
	{ key: "random", icon: Shuffle },
];

export function DiaryFilterBar({ filterMode, onFilterModeChange }: DiaryFilterBarProps) {
	const t = useTranslations("journalPanel");

	return (
		<div className="flex flex-col gap-0.5">
		{FILTERS.map(({ key, disabled, icon: Icon }) => {
				const isActive = filterMode === key;
				const labelKey =
					key === "all"
						? "sidebarFilterAll"
						: key === "last7"
							? "sidebarFilterLast7"
							: "sidebarFilterRandom";
				const tooltipKey =
					key === "random" ? "sidebarFilterRandomTooltip" : undefined;

				return (
					<button
						key={key}
						type="button"
						disabled={disabled}
						title={tooltipKey ? t(tooltipKey) : undefined}
						onClick={() => onFilterModeChange(key)}
						className={cn(
							"rounded-lg px-2 py-1.5 text-xs transition-colors w-full text-left flex items-center gap-1.5",
							isActive
								? "bg-primary/8 text-primary font-medium border border-primary/15"
								: "text-muted-foreground/70 hover:bg-muted/20 hover:text-foreground",
							disabled && "cursor-not-allowed opacity-40",
						)}
					>
						<Icon className="w-3.5 h-3.5 mr-2 shrink-0" />
						{t(labelKey)}
					</button>
				);
			})}
		</div>
	);
}
