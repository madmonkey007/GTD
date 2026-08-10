"use client";

import { ChevronDown, ChevronRight, Library } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCollections } from "@/lib/query";
import { cn } from "@/lib/utils";

interface CollectionListProps {
	selectedCollectionId?: number | null;
	onSelectCollection?: (id: number) => void;
	onOpenGallery?: () => void;
}

/** 侧边栏的「集合」入口：位于标签上方，列出集合并支持进入画廊页。 */
export function CollectionList({
	selectedCollectionId,
	onSelectCollection,
	onOpenGallery,
}: CollectionListProps) {
	const t = useTranslations("collection");
	const { data: collections = [], isLoading } = useCollections();
	const [collapsed, setCollapsed] = useState(true);
	const Chevron = collapsed ? ChevronRight : ChevronDown;

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between px-1">
				<button
					type="button"
					onClick={() => setCollapsed((v) => !v)}
					className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground"
					title={collapsed ? t("expand") : t("collapse")}
				>
					{t("entryTitle")}
					{collections.length > 0 && (
						<span className="font-normal tabular-nums text-muted-foreground/50">
							{collections.length}
						</span>
					)}
					<Chevron className="h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={onOpenGallery}
					className="text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground"
					title={t("openGallery")}
				>
					{t("viewAll")}
				</button>
			</div>

			{!collapsed &&
				(isLoading ? null : collections.length === 0 ? (
					<button
						type="button"
						onClick={onOpenGallery}
						className="flex items-center gap-2 rounded-lg border border-dashed border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:border-border hover:bg-muted/30"
					>
						<Library className="h-3 w-3" />
						{t("emptyEntry")}
					</button>
				) : (
					<div className="space-y-0.5">
						{collections.slice(0, 8).map((c) => {
							const isSelected = selectedCollectionId === c.id;
							return (
								<button
									key={c.id}
									type="button"
									onClick={() => onSelectCollection?.(c.id)}
									className={cn(
										"flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition-colors",
										isSelected
											? "bg-primary/10 text-primary font-medium"
											: "text-muted-foreground hover:bg-muted/30",
									)}
								>
									<span className="h-5 w-5 shrink-0 overflow-hidden rounded bg-muted/60">
										{c.coverImageUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={c.coverImageUrl}
												alt=""
												className="h-full w-full object-cover"
											/>
										) : (
											<span className="flex h-full w-full items-center justify-center">
												<Library className="h-3 w-3 text-muted-foreground/50" />
											</span>
										)}
									</span>
									<span className="flex-1 truncate text-left">{c.name}</span>
									<span
										className={cn(
											"rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums shrink-0",
											isSelected
												? "bg-primary/15 text-primary"
												: "bg-muted/40 text-muted-foreground",
										)}
									>
										{c.noteCount}
									</span>
								</button>
							);
						})}
					</div>
				))}
		</div>
	);
}
