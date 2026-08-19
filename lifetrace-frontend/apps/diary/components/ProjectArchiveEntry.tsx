"use client";

import { Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import { useArchivedProjects } from "@/lib/query";
import { cn } from "@/lib/utils";

/** 笔记侧边栏底部的「项目归档」入口：点击查看已归档项目，带数量角标 */
export function ProjectArchiveEntry({
	onShowArchive,
	active,
}: {
	onShowArchive?: () => void;
	active?: boolean;
}) {
	const t = useTranslations("project");
	const { data: archived = [] } = useArchivedProjects();

	return (
		<button
			type="button"
			onClick={onShowArchive}
			className={cn(
				"flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium uppercase tracking-wider transition-colors",
				active
					? "bg-primary/10 text-primary"
					: "text-muted-foreground/50 hover:bg-muted/20 hover:text-foreground/60",
			)}
		>
			<Archive className="w-3 h-3" />
			{t("archiveEntryTitle")}
			{archived.length > 0 && (
				<span className="ml-auto text-[10px] font-normal text-muted-foreground/40">
					{archived.length}
				</span>
			)}
		</button>
	);
}
