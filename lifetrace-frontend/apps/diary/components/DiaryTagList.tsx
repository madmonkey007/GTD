"use client";

import { ChevronDown, ChevronRight, MoreHorizontal, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TagMenuPopup } from "./TagMenu";

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
	const [menu, setMenu] = useState<{ tag: string; rect: DOMRect } | null>(null);
	const locale = document.documentElement.lang || "zh";
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
							const hasMenu = menu?.tag === tagName;
							return (
								<div
									key={tagName}
									role="group"
									className={cn(
										"group/tagitem flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
										hasMenu ? "bg-muted/40" : "hover:bg-muted/40",
										isSelected
											? "bg-primary/10 text-primary font-medium"
											: "text-muted-foreground",
									)}
								>
									<button
										type="button"
										className="flex flex-1 items-center gap-2 text-left min-w-0"
										onClick={() => onSelectTag?.(isSelected ? null : tagName)}
									>
										<Tag className="h-3 w-3 shrink-0" />
										<span className="flex-1 truncate">{tagName}</span>
									</button>
									<span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
										{count}
									</span>
									<button
										type="button"
										aria-label={`${tagName} menu`}
										className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover/tagitem:opacity-100 focus-visible:opacity-100 hover:text-foreground cursor-pointer"
										onClick={(e) => {
											e.stopPropagation();
											setMenu({ tag: tagName, rect: e.currentTarget.getBoundingClientRect() });
										}}
									>
										<MoreHorizontal className="h-3.5 w-3.5" />
									</button>
								</div>
							);
						})}
					</div>
				))}
			{menu && (
				<TagMenuPopup
					tagName={menu.tag}
					locale={locale}
					anchorRect={menu.rect}
					onClose={() => setMenu(null)}
				/>
			)}
		</div>
	);
}
