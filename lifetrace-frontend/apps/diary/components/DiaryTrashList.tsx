"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TrashEntry } from "@/apps/diary/hooks/useJournalTrash";
import { useJournalTrash } from "@/apps/diary/hooks/useJournalTrash";

export function DiaryTrashList({
	onShowTrash,
}: {
	onShowTrash?: () => void;
	onRestore?: (entry: TrashEntry) => void;
}) {
	const t = useTranslations("journalPanel");
	const { trashEntries } = useJournalTrash();

	return (
		<button
			type="button"
			onClick={onShowTrash}
			className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 hover:bg-muted/20 hover:text-foreground/60 transition-colors"
		>
			<Trash2 className="w-3 h-3" />
			{t("sidebarTrash")}
			{trashEntries.length > 0 && (
				<span className="ml-auto text-[10px] font-normal text-muted-foreground/40">
					{trashEntries.length}
				</span>
			)}
		</button>
	);
}
