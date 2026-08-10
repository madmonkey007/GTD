"use client";

import { FolderKanban, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useProjectMutations, useProjects } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

interface ProjectListProps {
	/** 外部受控选中态（可选）；默认读取 ui-store.selectedProjectId */
	selectedProjectId?: number | null;
	/** 点击项目回调（可选）；内部已默认打开 projectDetail 面板 */
	onSelectProject?: (id: number) => void;
}

/** 侧边栏的「项目」入口：待办侧/笔记侧共用，点击进入 projectDetail 面板。 */
export function ProjectList({
	selectedProjectId: selectedProjectIdProp,
	onSelectProject,
}: ProjectListProps) {
	const t = useTranslations("project");
	const { data: projects = [], isLoading } = useProjects();
	const { createProjectAsync } = useProjectMutations();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const storeSelectedId = useUiStore((s) => s.selectedProjectId);
	const storeSetSelectedProjectId = useUiStore((s) => s.setSelectedProjectId);
	const storeSetPanelFeature = useUiStore((s) => s.setPanelFeature);

	const selectedProjectId = selectedProjectIdProp ?? storeSelectedId;

	const openProject = (id: number) => {
		storeSetSelectedProjectId(id);
		useUiStore.setState({ isPanelCOpen: true });
		storeSetPanelFeature("panelC", "projectDetail");
		onSelectProject?.(id);
	};

	const handleCreate = async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			setCreating(false);
			return;
		}
		const created = await createProjectAsync({ name: trimmed });
		setName("");
		setCreating(false);
		if (created) openProject(created.id);
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between px-1">
				<span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
					<FolderKanban className="h-3 w-3" />
					{t("entryTitle")}
				</span>
				<button
					type="button"
					onClick={() => setCreating((v) => !v)}
					className="text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground"
					title={t("createTitle")}
				>
					<Plus className="h-3 w-3" />
				</button>
			</div>

			{creating && (
				<input
					autoFocus
					value={name}
					onChange={(e) => setName(e.target.value)}
					onBlur={handleCreate}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleCreate();
						if (e.key === "Escape") {
							setName("");
							setCreating(false);
						}
					}}
					placeholder={t("namePlaceholder")}
					className="h-7 w-full rounded-md border border-border/50 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			)}

			{isLoading ? null : projects.length === 0 && !creating ? (
				<button
					type="button"
					onClick={() => setCreating(true)}
					className="flex items-center gap-2 rounded-lg border border-dashed border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground/70 transition-colors hover:border-border hover:bg-muted/30"
				>
					<FolderKanban className="h-3 w-3" />
					{t("emptyEntry")}
				</button>
			) : (
				<div className="space-y-0.5">
					{projects.slice(0, 12).map((p) => {
						const isSelected = selectedProjectId === p.id;
						return (
							<button
								key={p.id}
								type="button"
								onClick={() => openProject(p.id)}
								className={cn(
									"flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition-colors",
									isSelected
										? "bg-primary/10 font-medium text-primary"
										: "text-muted-foreground hover:bg-muted/30",
								)}
							>
								<span
									className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
									style={
										p.color ? { backgroundColor: p.color } : undefined
									}
								>
									<FolderKanban
										className="h-3 w-3"
										style={{
											color: p.color ? "white" : undefined,
										}}
									/>
								</span>
								<span className="flex-1 truncate text-left">{p.name}</span>
								<span
									className={cn(
										"shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
										isSelected
											? "bg-primary/15 text-primary"
											: "bg-muted/40 text-muted-foreground",
									)}
									title={`${p.todoCount} ${t("todoUnit")} / ${p.noteCount} ${t("noteUnit")}`}
								>
									{p.todoCount + p.noteCount}
								</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
