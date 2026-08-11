"use client";

import { type DragEndEvent, useDndMonitor, useDroppable } from "@dnd-kit/core";
import {
	ChevronDown,
	ChevronRight,
	FolderKanban,
	Loader2,
	Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { type DragData, type DropData } from "@/lib/dnd";
import { useProjectMutations, useProjects } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface ProjectListProps {
	/** 进入项目详情时只展示哪一类内容：待办窗口传 "todo"，笔记窗口传 "note" */
	feature: "note" | "todo";
	/** 外部受控选中态（可选）；默认读取 ui-store.selectedProjectId */
	selectedProjectId?: number | null;
	/** 点击项目回调（可选）；内部已默认处理选中态 */
	onSelectProject?: (id: number) => void;
	/** 再次点击已选中项目时关闭（笔记侧用，替代返回按钮） */
	onCloseProject?: () => void;
}

/** 侧边栏的「项目」入口：待办侧/笔记侧共用（待办侧=按项目筛选，笔记侧=主区内联项目详情）。 */
export function ProjectList({
	feature,
	selectedProjectId: selectedProjectIdProp,
	onSelectProject,
	onCloseProject,
}: ProjectListProps) {
	const t = useTranslations("project");
	const { data: projects = [], isLoading } = useProjects();
	const { createProjectAsync, addTodosAsync } = useProjectMutations();
	const [collapsed, setCollapsed] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const storeSelectedId = useUiStore((s) => s.selectedProjectId);
	const storeSetSelectedProjectId = useUiStore((s) => s.setSelectedProjectId);
	const todoProjectFilter = useUiStore((s) => s.todoProjectFilter);
	const storeSetTodoProjectFilter = useUiStore((s) => s.setTodoProjectFilter);
	const storeSetSidebarMode = useUiStore((s) => s.setSidebarMode);
	const storeSetSidebarTag = useUiStore((s) => s.setSidebarTag);

	// 从待办列表拖拽待办到项目文件夹：自动将该待办加入项目
	const handleDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const { active, over } = event;
			if (!over) return;

			const dragData = active.data.current as DragData | undefined;
			const dropData = over.data.current as DropData | undefined;
			if (dragData?.type !== "TODO_CARD" || dropData?.type !== "PROJECT") {
				return;
			}

			const todoId = dragData.payload.todo.id;
			const projectId = dropData.metadata.projectId;
			try {
				await addTodosAsync({ id: projectId, todoIds: [todoId] });
				toastSuccess(t("dragAddSuccess"));
			} catch (err) {
				console.error("Failed to add todo to project:", err);
				toastError(t("dragAddError"));
			}
		},
		[addTodosAsync, t],
	);

	// 使用 useDndMonitor 监听全局拖拽事件（仅待办侧：待办列表只出现在待办窗口，避免笔记侧实例重复触发）
	useDndMonitor({
		onDragEnd: feature === "todo" ? handleDragEnd : undefined,
	});

	const selectedProjectId = selectedProjectIdProp ?? storeSelectedId;

	// 笔记侧：进入项目详情页（DiaryPanel 主区内联）
	const openProject = (id: number) => {
		storeSetSelectedProjectId(id);
		onSelectProject?.(id);
	};

	// 点击项目：待办侧 = 切换「按项目筛选」（再点同一项目取消）；笔记侧 = 进入项目页（再点同一项目关闭）
	const handleClickProject = (id: number) => {
		if (feature === "todo") {
			const willFilter = todoProjectFilter !== id;
			storeSetTodoProjectFilter(todoProjectFilter === id ? null : id);
			// 进入项目筛选态：清除侧边栏模式/标签筛选，避免"全部清单"等选项残留高亮
			if (willFilter) {
				storeSetSidebarMode(null);
				storeSetSidebarTag(null);
				const st = useUiStore.getState();
				if (st.isPanelBOpen && st.panelFeatureMap.panelB === "todoDetail") {
					st.togglePanelB();
				}
				if (!st.panelFeatureMap.panelC) {
					st.setPanelFeature("panelC", "chat");
				}
				if (!useUiStore.getState().isPanelCOpen) {
					useUiStore.getState().togglePanelC();
				}
			}
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
			<div className="flex items-center justify-between px-0">
				<button
					type="button"
					onClick={() => setCollapsed((v) => !v)}
					className="flex items-center gap-1.5 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground"
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
						projects.slice(0, 12).map((p) => (
							<ProjectItem
								key={p.id}
								projectId={p.id}
								name={p.name}
								color={p.color}
								isSelected={isProjectActive(p.id)}
								droppable={feature === "todo"}
								onClick={() => handleClickProject(p.id)}
							/>
						))
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

/** 单个项目项：既是点击入口，也是待办拖拽的放置目标（TODO_CARD → PROJECT） */
function ProjectItem({
	projectId,
	name,
	color,
	isSelected,
	droppable,
	onClick,
}: {
	projectId: number;
	name: string;
	color: string | null;
	isSelected: boolean;
	/** 是否作为拖拽放置目标（仅待办侧开启） */
	droppable: boolean;
	onClick: () => void;
}) {
	const dropData: DropData = useMemo(
		() => ({ type: "PROJECT" as const, metadata: { projectId } }),
		[projectId],
	);
	const { isOver, setNodeRef } = useDroppable({
		id: `project-${projectId}`,
		data: dropData,
		disabled: !droppable,
	});

	return (
		<button
			ref={setNodeRef}
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition-colors",
				isSelected
					? "bg-primary/10 font-medium text-primary"
					: "text-muted-foreground hover:bg-muted/30",
				isOver && "bg-primary/10 ring-1 ring-primary/30",
			)}
		>
			<span
				className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
				style={color ? { backgroundColor: color } : undefined}
			>
				<FolderKanban
					className="h-3 w-3"
					style={{
						color: color ? "white" : undefined,
					}}
				/>
			</span>
			<span className="flex-1 truncate text-left">{name}</span>
		</button>
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
