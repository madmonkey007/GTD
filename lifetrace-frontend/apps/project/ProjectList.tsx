"use client";

import {
	ChevronDown,
	ChevronRight,
	FolderKanban,
	Loader2,
	Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { useProjectMutations, useProjects } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

interface ProjectListProps {
	/** 进入项目详情时只展示哪一类内容：待办窗口传 "todo"，笔记窗口传 "note" */
	feature: "note" | "todo";
	/** 外部受控选中态（可选）；默认读取 ui-store.selectedProjectId */
	selectedProjectId?: number | null;
	/** 点击项目回调（可选）；内部已默认打开 projectDetail 面板 */
	onSelectProject?: (id: number) => void;
	/** 再次点击已选中项目时关闭（笔记侧用，替代返回按钮） */
	onCloseProject?: () => void;
}

/** 侧边栏的「项目」入口：待办侧/笔记侧共用，点击进入 projectDetail 面板（只展示各自内容）。 */
export function ProjectList({
	feature,
	selectedProjectId: selectedProjectIdProp,
	onSelectProject,
	onCloseProject,
}: ProjectListProps) {
	const t = useTranslations("project");
	const { data: projects = [], isLoading } = useProjects();
	const { createProjectAsync } = useProjectMutations();
	const [collapsed, setCollapsed] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const storeSelectedId = useUiStore((s) => s.selectedProjectId);
	const storeSetSelectedProjectId = useUiStore((s) => s.setSelectedProjectId);
	const storeSetProjectDetailFeature = useUiStore(
		(s) => s.setProjectDetailFeature,
	);
	const todoProjectFilter = useUiStore((s) => s.todoProjectFilter);
	const storeSetTodoProjectFilter = useUiStore((s) => s.setTodoProjectFilter);

	const selectedProjectId = selectedProjectIdProp ?? storeSelectedId;

	// 笔记侧：进入项目详情页（DiaryPanel 主区内联）
	const openProject = (id: number) => {
		storeSetSelectedProjectId(id);
		storeSetProjectDetailFeature(feature);
		onSelectProject?.(id);
	};

	// 点击项目：待办侧 = 切换「按项目筛选」（再点同一项目取消）；笔记侧 = 进入项目页（再点同一项目关闭）
	const handleClickProject = (id: number) => {
		if (feature === "todo") {
			storeSetTodoProjectFilter(todoProjectFilter === id ? null : id);
		} else {
			if (selectedProjectId === id) {
				storeSetSelectedProjectId(null);
				onCloseProject?.();
			} else {
				openProject(id);
			}
		}
	};

	// 某项目是否处于选中/筛选态
	const isProjectActive = (id: number) =>
		feature === "todo"
			? todoProjectFilter === id
			: selectedProjectId === id;

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
					<Chevron className="h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground"
					title={t("createTitle")}
				>
					<Plus className="h-3 w-3" />
				</button>
			</div>

			{!collapsed && (
				<div className="space-y-0.5">
					{isLoading ? null : projects.length === 0 ? (
						// 空状态：只给一行文案，不用「创建你的第一个项目」按钮（创建走 + 号弹窗）
						<p className="px-1.5 py-1 text-xs text-muted-foreground/50">
							{t("empty")}
						</p>
					) : (
						projects.slice(0, 12).map((p) => {
							const isSelected = isProjectActive(p.id);
							return (
								<button
									key={p.id}
									type="button"
									onClick={() => handleClickProject(p.id)}
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
								</button>
							);
						})
					)}
				</div>
			)}

			<CreateProjectDialog
				open={showCreate}
				onClose={() => setShowCreate(false)}
				onCreated={(id) => {
					setCollapsed(false);
					if (feature === "todo") {
						storeSetTodoProjectFilter(id);
					} else {
						openProject(id);
					}
				}}
				createProjectAsync={createProjectAsync}
			/>
		</div>
	);
}

/** 新建项目弹窗：输入名称后创建，替代原来的内联输入框 */
function CreateProjectDialog({
	open,
	onClose,
	onCreated,
	createProjectAsync,
}: {
	open: boolean;
	onClose: () => void;
	onCreated: (id: number) => void;
	createProjectAsync: (input: { name: string }) => Promise<
		| { id: number; uid: string; name: string }
		| null
		| undefined
	>;
}) {
	const t = useTranslations("project");
	const [name, setName] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const reset = () => {
		setName("");
		setSubmitting(false);
	};

	const close = () => {
		reset();
		onClose();
	};

	const submit = async () => {
		const trimmed = name.trim();
		if (!trimmed || submitting) return;
		setSubmitting(true);
		try {
			const created = await createProjectAsync({ name: trimmed });
			reset();
			onClose();
			if (created) onCreated(created.id);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) close();
			}}
		>
			<DialogContent className="max-w-[380px] gap-0 p-0 overflow-hidden">
				<DialogTitle className="px-4 pt-4 text-sm font-semibold">
					{t("createTitle")}
				</DialogTitle>
				<div className="px-4 pb-4 pt-3">
					<input
						// eslint-disable-next-line jsx-a11y/no-autofocus
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submit();
							if (e.key === "Escape") close();
						}}
						placeholder={t("namePlaceholder")}
						className="h-9 w-full rounded-md border border-border/50 bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
					/>
					<div className="mt-3 flex justify-end gap-2">
						<button
							type="button"
							onClick={close}
							className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
						>
							{t("cancel")}
						</button>
						<button
							type="button"
							onClick={submit}
							disabled={!name.trim() || submitting}
							className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
						>
							{submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
							{t("create")}
						</button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
