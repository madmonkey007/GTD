"use client";

import {
	type DragEndEvent,
	useDndMonitor,
	useDroppable,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Archive,
	ChevronDown,
	ChevronRight,
	FolderKanban,
	ListChecks,
	Loader2,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import type { DragData, DropData } from "@/lib/dnd";
import { isProjectItemDragData } from "@/lib/dnd";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
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
	/** 按 projectType 过滤（默认全部，笔记侧传 "project" 排除 checklist） */
	type?: string;
}

/** 侧边栏的「项目」入口：待办侧/笔记侧共用（待办侧=按项目筛选，笔记侧=主区内联项目详情）。 */
export function ProjectList({
	feature,
	selectedProjectId: selectedProjectIdProp,
	onSelectProject,
	onCloseProject,
	type: projectTypeFilter,
}: ProjectListProps) {
	const t = useTranslations("project");
	const { data: projects = [], isLoading } = useProjects(projectTypeFilter);
	const { createProjectAsync, updateProjectAsync, deleteProjectAsync, addTodosAsync, reorderProjectsAsync } =
		useProjectMutations();
	const [collapsed, setCollapsed] = useState(true);
	const [checklistCollapsed, setChecklistCollapsed] = useState(false);
	const [showCreate, setShowCreate] = useState(false);
	const [showCreateChecklist, setShowCreateChecklist] = useState(false);
	const isMobile = useIsMobile();
	const storeSelectedId = useUiStore((s) => s.selectedProjectId);
	const storeSetSelectedProjectId = useUiStore((s) => s.setSelectedProjectId);
	const todoProjectFilter = useUiStore((s) => s.todoProjectFilter);
	const storeSetTodoProjectFilter = useUiStore((s) => s.setTodoProjectFilter);
	const storeSetSidebarMode = useUiStore((s) => s.setSidebarMode);
	const storeSetSidebarTag = useUiStore((s) => s.setSidebarTag);

	// 清单与项目分组：清单（checklist）独立展示，其余归项目组；均按 sortOrder 排序（拖拽后乐观更新立即换序）
	const checklists = useMemo(
		() =>
			projects
				.filter((p) => p.projectType === "checklist")
				.sort((a, b) => a.sortOrder - b.sortOrder),
		[projects],
	);
	const regularProjects = useMemo(
		() =>
			projects
				.filter((p) => p.projectType !== "checklist")
				.sort((a, b) => a.sortOrder - b.sortOrder),
		[projects],
	);

	// 拖拽结束统一处理：
	// 路径 A - PROJECT_ITEM 内部重排（清单组/项目组各自排序，所有侧边栏）；
	// 路径 B - TODO_CARD 拖到项目文件夹自动加入项目（仅待办侧）
	const handleDragEnd = useCallback(
		async (event: DragEndEvent) => {
			const { active, over } = event;
			if (!over) return;

			const dragData = active.data.current as DragData | undefined;
			const dropData = over.data.current as DragData | DropData | undefined;

			// 路径 A：清单/项目内部重排
			if (dragData && isProjectItemDragData(dragData)) {
				// 待办侧 + 笔记侧两个实例都会收到事件，只让来源实例处理
				if (dragData.payload.sourcePanel !== feature) return;

				// over 可能是数字 id（useSortable 命中，data 为 PROJECT_ITEM）
				// 或 "project-{id}"（useDroppable 命中，data 为 PROJECT），统一从 dropData 解析目标项目
				let overId: number | null = null;
				if (dropData?.type === "PROJECT_ITEM") {
					overId = dropData.payload.projectId;
				} else if (dropData?.type === "PROJECT") {
					overId = dropData.metadata.projectId;
				}
				if (overId === null || overId === dragData.payload.projectId) return;

				const activeProject = projects.find((p) => p.id === dragData.payload.projectId);
				const overProject = projects.find((p) => p.id === overId);
				if (!activeProject || !overProject) return;

				// 清单与项目是两个独立组，不允许跨组排序
				const activeGroup = activeProject.projectType === "checklist" ? "checklist" : "project";
				const overGroup = overProject.projectType === "checklist" ? "checklist" : "project";
				if (activeGroup !== overGroup) return;

				const group =
					activeGroup === "checklist"
						? checklists
						: regularProjects;

				const oldIndex = group.findIndex((p) => p.id === dragData.payload.projectId);
				const newIndex = group.findIndex((p) => p.id === overId);
				if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

				const reordered = arrayMove(group, oldIndex, newIndex);
				const items = reordered.map((p, index) => ({ id: p.id, sortOrder: index }));
				try {
					await reorderProjectsAsync(items);
					toastSuccess(t("reorderSuccess"));
				} catch (err) {
					console.error("Failed to reorder projects:", err);
					toastError(t("reorderError"));
				}
				return;
			}

			// 路径 B：TODO_CARD 拖到项目文件夹 → 加入项目（仅待办侧）
			if (feature !== "todo" || dragData?.type !== "TODO_CARD") return;

			// over 命中 PROJECT droppable（id "project-{id}"）或 PROJECT_ITEM sortable（id 为数字）
			let projectId: number | null = null;
			if (dropData?.type === "PROJECT") {
				projectId = dropData.metadata.projectId;
			} else if (dropData?.type === "PROJECT_ITEM") {
				projectId = dropData.payload.projectId;
			}
			if (projectId === null) return;

			try {
				await addTodosAsync({ id: projectId, todoIds: [dragData.payload.todo.id] });
				toastSuccess(t("dragAddSuccess"));
			} catch (err) {
				console.error("Failed to add todo to project:", err);
				toastError(t("dragAddError"));
			}
		},
		[addTodosAsync, reorderProjectsAsync, projects, checklists, regularProjects, feature, t],
	);

	// 删除/归档后清掉残留的筛选/选中态
	const clearProjectState = useCallback((id: number) => {
		const st = useUiStore.getState();
		if (st.todoProjectFilter === id) st.setTodoProjectFilter(null);
		if (st.selectedProjectId === id) st.setSelectedProjectId(null);
	}, []);

	const handleArchive = useCallback(
		async (id: number, archived: boolean, isChecklist: boolean) => {
			try {
				await updateProjectAsync({ id, input: { isArchived: archived } });
				toastSuccess(
					t(archived ? "archiveSuccess" : "unarchiveSuccess", {
						name: isChecklist ? t("checklistEntryTitle") : t("entryTitle"),
					}),
				);
				clearProjectState(id);
			} catch (err) {
				console.error("Failed to archive project:", err);
				toastError(t("archiveError"));
			}
		},
		[updateProjectAsync, t, clearProjectState],
	);

	const handleDelete = useCallback(
		async (id: number) => {
			try {
				await deleteProjectAsync(id);
				toastSuccess(t("deleteSuccess"));
				clearProjectState(id);
			} catch (err) {
				console.error("Failed to delete project:", err);
				toastError(t("deleteError"));
			}
		},
		[deleteProjectAsync, t, clearProjectState],
	);

	// 使用 useDndMonitor 监听全局拖拽事件（项目重排待办/笔记两侧都支持；路径 B 内部已按 feature 过滤）
	useDndMonitor({
		onDragEnd: handleDragEnd,
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
	const ChecklistChevron = checklistCollapsed ? ChevronRight : ChevronDown;

	return (
		<div className="flex flex-col gap-1">
			{/* 清单组：待办侧始终展示（空时保留入口和 + 创建），笔记侧仅在已有清单时展示 */}
			{(checklists.length > 0 || feature === "todo") && (
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between px-0">
						<button
							type="button"
							onClick={() => setChecklistCollapsed((v) => !v)}
							className={cn(
								"flex items-center gap-1.5 px-2.5 text-sm font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground",
								isMobile && "min-h-11",
							)}
							title={checklistCollapsed ? t("expand") : t("collapse")}
						>
							{t("checklistEntryTitle")}
							<ChecklistChevron className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
						</button>
						<button
							type="button"
							onClick={() => setShowCreateChecklist(true)}
							className={cn(
								"text-xs text-muted-foreground/50 transition-colors hover:text-foreground",
								isMobile ? "flex h-9 w-9 items-center justify-center" : "",
							)}
							title={t("createTitle")}
						>
							<Plus className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
						</button>
					</div>
					{!checklistCollapsed && (
						<SortableContext
							items={checklists.map((p) => p.id)}
							strategy={verticalListSortingStrategy}
						>
							<div className="space-y-0.5">
								{isLoading ? null : checklists.length === 0 ? (
									<p className="px-1.5 py-1 text-xs text-muted-foreground/50">
										{t("checklistEmpty")}
									</p>
								) : (
									checklists.map((p) => (
										<ProjectItem
											key={p.id}
											projectId={p.id}
											name={p.name}
											color={p.color}
											isSelected={isProjectActive(p.id)}
											droppable={feature === "todo"}
											onClick={() => handleClickProject(p.id)}
											icon={ListChecks}
											isChecklist
											sourcePanel={feature}
											onArchive={handleArchive}
											onDelete={handleDelete}
										/>
									))
								)}
							</div>
						</SortableContext>
					)}
				</div>
			)}

			<div className="flex items-center justify-between px-0">
				<button
					type="button"
					onClick={() => setCollapsed((v) => !v)}
					className={cn(
						"flex items-center gap-1.5 px-2.5 text-sm font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground",
						isMobile && "min-h-11",
					)}
					title={collapsed ? t("expand") : t("collapse")}
				>
					{t("entryTitle")}
					<Chevron className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
				</button>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className={cn(
						"text-xs text-muted-foreground/50 transition-colors hover:text-foreground",
						isMobile ? "flex h-9 w-9 items-center justify-center" : "",
					)}
					title={t("createTitle")}
				>
					<Plus className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
				</button>
			</div>

			{!collapsed && (
				<SortableContext
					items={regularProjects.slice(0, 12).map((p) => p.id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="space-y-0.5">
						{isLoading ? null : regularProjects.length === 0 ? (
							// 空状态：只给一行文案，不用「创建你的第一个项目」按钮（创建走 + 号弹窗）
							<p className="px-1.5 py-1 text-xs text-muted-foreground/50">
								{t("empty")}
							</p>
						) : (
							regularProjects.slice(0, 12).map((p) => (
								<ProjectItem
									key={p.id}
									projectId={p.id}
									name={p.name}
									color={p.color}
									isSelected={isProjectActive(p.id)}
									droppable={feature === "todo"}
									onClick={() => handleClickProject(p.id)}
									isChecklist={false}
									sourcePanel={feature}
									onArchive={handleArchive}
									onDelete={handleDelete}
								/>
							))
					)}
				</div>
				</SortableContext>
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
				projectType={projectTypeFilter}
			/>
			<CreateProjectDialog
				open={showCreateChecklist}
				onClose={() => setShowCreateChecklist(false)}
				onCreated={(id) => {
					setChecklistCollapsed(false);
					if (feature === "todo") {
						storeSetTodoProjectFilter(id);
					}
				}}
				createProjectAsync={createProjectAsync}
				projectType="checklist"
			/>
		</div>
	);
}

/** 单个项目项：既是点击入口，也是待办拖拽的放置目标（TODO_CARD → PROJECT），右侧带 ... 操作菜单 */
function ProjectItem({
	projectId,
	name,
	color,
	isSelected,
	droppable,
	onClick,
	icon: Icon = FolderKanban,
	isChecklist,
	sourcePanel,
	onArchive,
	onDelete,
}: {
	projectId: number;
	name: string;
	color: string | null;
	isSelected: boolean;
	/** 是否作为拖拽放置目标（仅待办侧开启） */
	droppable: boolean;
	onClick: () => void;
	/** 条目图标（清单用 ListChecks，普通项目默认文件夹） */
	icon?: typeof FolderKanban;
	/** 是否清单类型（影响确认弹窗文案） */
	isChecklist: boolean;
	/** 来源侧标识（todo | note），重排时区分待办/笔记双实例 */
	sourcePanel: string;
	onArchive: (id: number, archived: boolean, isChecklist: boolean) => void;
	onDelete: (id: number) => void;
}) {
	const t = useTranslations("project");
	const isMobile = useIsMobile();
	const [menuOpen, setMenuOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [confirmArchive, setConfirmArchive] = useState(false);
	const { updateProjectAsync } = useProjectMutations();
	const menuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onDocClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onEsc);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onEsc);
		};
	}, [menuOpen]);

	const dropData: DropData = useMemo(
		() => ({ type: "PROJECT" as const, metadata: { projectId } }),
		[projectId],
	);
	const dragData: DragData = useMemo(
		() => ({
			type: "PROJECT_ITEM",
			payload: { projectId, name, color, isChecklist, sourcePanel },
		}),
		[projectId, name, color, isChecklist, sourcePanel],
	);
	const { isOver, setNodeRef: setDroppableRef } = useDroppable({
		id: `project-${projectId}`,
		data: dropData,
		disabled: !droppable,
	});
	const {
		attributes,
		listeners,
		setNodeRef: setSortableRef,
		transform,
		transition,
		isDragging: isSortableDragging,
	} = useSortable({
		id: projectId,
		data: dragData,
	});
	const setRefs = (el: HTMLElement | null) => {
		setDroppableRef(el);
		setSortableRef(el);
	};

	const submitEdit = async () => {
		const trimmed = editName.trim();
		if (!trimmed) return;
		try {
			await updateProjectAsync({ id: projectId, input: { name: trimmed } });
			setEditing(false);
		} catch (err) {
			console.error("Failed to rename project:", err);
			toastError(t("renameError"));
		}
	};

	const entityName = isChecklist ? t("checklistEntryTitle") : t("entryTitle");

	return (
		<div
			ref={setRefs}
			{...attributes}
			{...listeners}
			className={cn("group relative", isSortableDragging && "opacity-50")}
			style={{
				transform: CSS.Transform.toString(transform),
				transition: isSortableDragging ? "none" : transition,
			}}
		>
			<button
				type="button"
				onClick={onClick}
				className={cn(
					"flex w-full items-center gap-2 rounded-lg px-1.5 text-sm transition-colors",
					isMobile ? "min-h-11" : "py-1",
					isSelected
						? "bg-primary/10 font-medium text-primary"
						: "text-muted-foreground hover:bg-muted/30",
					isOver && "bg-primary/10 ring-1 ring-primary/30",
				)}
			>
				<span
					className={cn(
						"flex shrink-0 items-center justify-center rounded",
						isMobile ? "h-6 w-6" : "h-5 w-5",
					)}
					style={color ? { backgroundColor: color } : undefined}
				>
					<Icon
						className={cn(isMobile ? "h-3.5 w-3.5" : "h-3 w-3")}
						style={{
							color: color ? "white" : undefined,
						}}
					/>
				</span>
				<span className="flex-1 truncate text-left">{name}</span>
			</button>
			<button
				type="button"
				aria-label={t("more")}
				onClick={(e) => {
					e.stopPropagation();
					setMenuOpen((v) => !v);
				}}
				className={cn(
					"absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded text-muted-foreground/60 transition-all hover:bg-muted hover:text-foreground",
					isMobile ? "h-8 w-8 opacity-100" : "h-6 w-6 opacity-0 group-hover:opacity-100",
					menuOpen && "opacity-100",
				)}
			>
				<MoreHorizontal className="h-4 w-4" />
			</button>

			{menuOpen && (
				<div
					ref={menuRef}
					className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border border-border/60 bg-popover py-1 text-sm shadow-lg"
				>
					<button
						type="button"
						onClick={() => {
							setMenuOpen(false);
							setEditName(name);
							setEditing(true);
						}}
						className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-foreground/90 transition-colors hover:bg-muted/50"
					>
						<Pencil className="h-3.5 w-3.5" />
						{t("rename")}
					</button>
					<button
						type="button"
						onClick={() => {
							setMenuOpen(false);
							setConfirmArchive(true);
						}}
						className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-foreground/90 transition-colors hover:bg-muted/50"
					>
						<Archive className="h-3.5 w-3.5" />
						{t("archive")}
					</button>
					<button
						type="button"
						onClick={() => {
							setMenuOpen(false);
							setConfirmDelete(true);
						}}
						className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-500/90 transition-colors hover:bg-red-500/10"
					>
						<Trash2 className="h-3.5 w-3.5" />
						{t("delete")}
					</button>
				</div>
			)}

			{/* 编辑名称弹窗 */}
			{editing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-sm rounded-xl border border-border/60 bg-background p-4 shadow-xl">
						<h3 className="text-sm font-semibold">{t("renameTitle", { entity: entityName })}</h3>
						<input
							// eslint-disable-next-line jsx-a11y/no-autofocus
							autoFocus
							value={editName}
							onChange={(e) => setEditName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") submitEdit();
								if (e.key === "Escape") setEditing(false);
							}}
							className="mt-3 h-9 w-full rounded-md border border-border/50 bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
						/>
						<div className="mt-3 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setEditing(false)}
								className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
							>
								{t("cancel")}
							</button>
							<button
								type="button"
								onClick={submitEdit}
								disabled={!editName.trim()}
								className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-50"
							>
								{t("save")}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 归档确认弹窗 */}
			{confirmArchive && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-sm rounded-xl border border-border/60 bg-background p-4 shadow-xl">
						<h3 className="text-sm font-semibold">
							{t("archiveConfirmTitle", { entity: entityName })}
						</h3>
						<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
							{t("archiveConfirmDesc", { entity: entityName, name })}
						</p>
						<div className="mt-3 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmArchive(false)}
								className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
							>
								{t("cancel")}
							</button>
							<button
								type="button"
								onClick={() => {
									setConfirmArchive(false);
									onArchive(projectId, true, isChecklist);
								}}
								className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97]"
							>
								{t("archiveConfirmAction")}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 删除确认弹窗 */}
			{confirmDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-sm rounded-xl border border-border/60 bg-background p-4 shadow-xl">
						<h3 className="text-sm font-semibold">
							{t("deleteConfirmTitle", { entity: entityName })}
						</h3>
						<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
							{t("deleteConfirmDesc", { entity: entityName, name })}
						</p>
						<div className="mt-3 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
							>
								{t("cancel")}
							</button>
							<button
								type="button"
								onClick={() => {
									setConfirmDelete(false);
									onDelete(projectId);
								}}
								className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-500/90 active:scale-[0.97]"
							>
								{t("deleteConfirmAction")}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/** 新建项目弹窗：输入名称后创建，替代原来的内联输入框 */
function CreateProjectDialog({
	open,
	onClose,
	onCreated,
	createProjectAsync,
	projectType,
}: {
	open: boolean;
	onClose: () => void;
	onCreated: (id: number) => void;
	createProjectAsync: (input: { name: string; projectType?: string }) => Promise<
		| { id: number; uid: string; name: string }
		| null
		| undefined
	>;
	projectType?: string;
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
			const created = await createProjectAsync({ name: trimmed, projectType: projectType });
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
					{projectType === "checklist" ? t("createChecklistTitle") : t("createTitle")}
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
						placeholder={
							projectType === "checklist"
								? t("checklistNamePlaceholder")
								: t("namePlaceholder")
						}
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
