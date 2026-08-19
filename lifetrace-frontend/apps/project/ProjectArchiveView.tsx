"use client";

import { Archive, FolderKanban, ListChecks, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { motion } from "framer-motion";
import type { ProjectView } from "@/lib/query";
import { useProjectMutations } from "@/lib/query";
import { toastError, toastSuccess } from "@/lib/toast";

interface ProjectArchiveViewProps {
	projects: ProjectView[];
	/** 取消归档后视图外可选回调（如刷新侧栏计数） */
	onUnarchived?: () => void;
}

/** 笔记侧「项目归档」视图：列出已归档项目，支持取消归档 / 删除 */
export function ProjectArchiveView({ projects, onUnarchived }: ProjectArchiveViewProps) {
	const t = useTranslations("project");
	const { updateProjectAsync, deleteProjectAsync } = useProjectMutations();
	const [pendingId, setPendingId] = useState<number | null>(null);

	const handleUnarchive = async (p: ProjectView) => {
		setPendingId(p.id);
		try {
			await updateProjectAsync({ id: p.id, input: { isArchived: false } });
			toastSuccess(
				t("unarchiveSuccess", {
					name: p.projectType === "checklist" ? t("checklistEntryTitle") : t("entryTitle"),
				}),
			);
			onUnarchived?.();
		} catch (err) {
			console.error("Failed to unarchive project:", err);
			toastError(t("unarchiveError"));
		} finally {
			setPendingId(null);
		}
	};

	const handleDelete = async (p: ProjectView) => {
		setPendingId(p.id);
		try {
			await deleteProjectAsync(p.id);
			toastSuccess(t("deleteSuccess"));
		} catch (err) {
			console.error("Failed to delete project:", err);
			toastError(t("deleteError"));
		} finally {
			setPendingId(null);
		}
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 shrink-0">
				<Archive className="w-4 h-4 text-muted-foreground/40" />
				<h2 className="text-sm font-semibold tracking-tight">{t("archiveViewTitle")}</h2>
				{projects.length > 0 && (
					<span className="text-[11px] text-muted-foreground/40 font-normal">
						({projects.length})
					</span>
				)}
			</div>

			{/* Cards list */}
			<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
				{projects.length === 0 ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-xs text-muted-foreground/40 italic">
							{t("archiveViewEmpty")}
						</p>
					</div>
				) : (
					projects.map((p) => {
						const isChecklist = p.projectType === "checklist";
						const Icon = isChecklist ? ListChecks : FolderKanban;
						const isPending = pendingId === p.id;
						return (
							<motion.div
								key={p.id}
								layout
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
								className={
									"rounded-xl border border-border/30 bg-card px-4 py-3 transition-all duration-200 hover:border-border/60 " +
									(isPending ? "opacity-50 pointer-events-none" : "")
								}
							>
								<div className="flex items-center gap-2">
									<span
										className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
										style={
											p.color
												? { backgroundColor: `${p.color}1a`, color: p.color }
												: undefined
										}
									>
										<Icon className="h-3.5 w-3.5" />
									</span>
									<span className="text-sm font-semibold text-foreground truncate flex-1">
										{p.name}
									</span>
									<span className="text-[10px] text-muted-foreground/40 shrink-0">
										{isChecklist
											? t("checklistEntryTitle")
											: `${p.todoCount} ${t("todoUnit")} · ${p.noteCount} ${t("noteUnit")}`}
									</span>
								</div>
								{p.description && (
									<p className="mt-1 pl-8 text-xs text-muted-foreground/70 truncate">
										{p.description}
									</p>
								)}
								<div className="mt-2 flex items-center justify-end gap-1">
									<button
										type="button"
										onClick={() => handleUnarchive(p)}
										className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary/70 hover:text-primary hover:bg-primary/8 transition-colors"
									>
										<RotateCcw className="w-3.5 h-3.5" />
										{t("unarchive")}
									</button>
									<button
										type="button"
										onClick={() => handleDelete(p)}
										className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive/60 hover:text-destructive hover:bg-destructive/5 transition-colors"
									>
										<Trash2 className="w-3.5 h-3.5" />
										{t("delete")}
									</button>
								</div>
							</motion.div>
						);
					})
				)}
			</div>
		</div>
	);
}
