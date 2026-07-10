"use client";

import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";

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

	if (tagsWithCount.length === 0) {
		return (
			<div>
				<div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
					<Tag className="w-3 h-3" />
					{t("sidebarTags")}
				</div>
				<div className="text-xs text-muted-foreground/50 italic px-2.5">
					{t("noTags")}
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
				<Tag className="w-3 h-3" />
				{t("sidebarTags")}
			</div>
			<div className="space-y-0.5">
				{tagsWithCount.map(({ tagName, count }) => {
					const isSelected = selectedTag === tagName;
					return (
						<button
							type="button"
							key={tagName}
							onClick={() => onSelectTag?.(isSelected ? null : tagName)}
							className={"flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors " + (
								isSelected
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground hover:bg-muted/30"
							)}
						>
							<span className="truncate">{tagName}</span>
							<span className={"rounded-full px-1.5 py-0.5 text-[10px] font-medium ml-2 tabular-nums shrink-0 " + (
								isSelected
									? "bg-primary/15 text-primary"
									: "bg-muted/40 text-muted-foreground"
							)}>
								{count}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
