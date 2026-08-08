"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CollectionNoteView } from "@/lib/query";

interface CollectionListViewProps {
	notes: CollectionNoteView[];
	/** 点击某条笔记：切到卡片滑动视图并定位到该笔记 */
	onReadNote?: (index: number) => void;
}

/** 卡片列表视图（集合详情默认视图）：多条笔记以卡片列表平铺，点击进入沉浸阅读。 */
export function CollectionListView({ notes, onReadNote }: CollectionListViewProps) {
	const t = useTranslations("collection");

	if (notes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("noNotes")}
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col gap-2 overflow-y-auto pb-4">
			{notes.map((n, i) => (
				<button
					key={n.id}
					type="button"
					onClick={() => onReadNote?.(i)}
					className="group flex items-start gap-3 rounded-(--radius) bg-[oklch(var(--card))] p-3 text-left shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] transition-all hover:bg-muted/30 active:scale-[0.99]"
				>
					<div className="min-w-0 flex-1">
						{n.date && (
							<p className="mb-0.5 text-[11px] text-muted-foreground/60">
								{new Date(n.date).toLocaleString()}
							</p>
						)}
						<p className="line-clamp-3 text-sm leading-relaxed text-foreground/80">
							{n.preview || t("emptyNote")}
						</p>
					</div>
					<ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
				</button>
			))}
		</div>
	);
}
