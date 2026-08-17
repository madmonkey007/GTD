"use client";

import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TagsWithCount {
	tagName: string;
	count: number;
}

interface DiaryTagListProps {
	tagsWithCount: TagsWithCount[];
	selectedTag?: string | null;
	onSelectTag?: (tagName: string | null) => void;
}

export function DiaryTagList({ tagsWithCount, selectedTag, onSelectTag }: DiaryTagListProps) {
	const t = useTranslations("journalPanel");
	const [expanded, setExpanded] = useState(true);
	const Chevron = expanded ? ChevronDown : ChevronRight;

	return (
		<div className="flex flex-col gap-0.5">
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex items-center gap-1 px-2.5 py-1 text-sm font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground"
			>
				{t("sidebarTags")}
				<Chevron className="h-3 w-3" />
			</button>

			{expanded &&
				(tagsWithCount.length === 0 ? (
					<p className="px-2.5 py-1 text-xs text-muted-foreground/50">{t("noTags")}</p>
				) : (
					<div className="flex flex-col gap-0.5">
						{tagsWithCount.map(({ tagName, count }) => {
							const isSelected = selectedTag === tagName;
							return (
								<button
									type="button"
									key={tagName}
									onClick={() => onSelectTag?.(isSelected ? null : tagName)}
									className={cn(
										"flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
										"hover:bg-muted/40",
										isSelected
											? "bg-primary/10 text-primary font-medium"
											: "text-muted-foreground",
									)}
								>
									<Tag className="h-3 w-3 shrink-0" />
									<span className="flex-1 truncate text-left">{tagName}</span>
									<span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
										{count}
									</span>
								</button>
							);
						})}
					</div>
				))}
		</div>
	);
}
