"use client";

import { useTranslations } from "next-intl";

interface DiaryStatsProps {
	totalNotes: number;
	totalTags: number;
	totalDays: number;
}

export function DiaryStats({ totalNotes, totalTags, totalDays }: DiaryStatsProps) {
	const t = useTranslations("journalPanel");

	const items = [
		{ value: totalNotes, label: t("sidebarStatsNotes") },
		{ value: totalTags, label: t("sidebarStatsTags") },
		{ value: totalDays, label: t("sidebarStatsDays") },
	];

	return (
		<div className="grid grid-cols-3 gap-2">
			{items.map((item) => (
				<div
					key={item.label}
					className="rounded-xl border border-border/30 bg-background/50 px-2 py-2.5 text-center"
				>
					<div className="text-xl font-bold text-foreground leading-none tracking-tight">
						{item.value}
					</div>
					<div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 leading-tight">
						{item.label}
					</div>
				</div>
			))}
		</div>
	);
}
