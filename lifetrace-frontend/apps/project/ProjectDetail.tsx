"use client";

import {
	ArrowLeft,
	Check,
	Columns2,
	FolderKanban,
	ListTodo,
	Pencil,
	Rows2,
	Trash2,
	X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NoteMarkdown } from "@/apps/diary/components/NoteMarkdown";
import { useProject, useProjectMutations } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { ProjectNoteManager } from "./ProjectNoteManager";
import { ProjectTodoManager } from "./ProjectTodoManager";

const STATUS_LABEL: Record<string, string> = {
	active: "进行中",
	completed: "已完成",
	cancelled: "已取消",
	postponed: "已推迟",
	"needs-action": "待处理",
	"in-process": "进行中",
};

interface ProjectDetailProps {
	/** 可选：外部直接指定项目 ID；默认从 ui-store.selectedProjectId 读取 */
	projectId?: number | null;
	/** 可选：指定只展示哪一类内容；默认从 ui-store.projectDetailFeature 读取（由入口侧设置） */
	feature?: "note" | "todo";
	/** 可选：提供返回回调时，在标题栏左侧显示返回箭头（移动端场景）；笔记项目页不传，无返回按钮 */
	onBack?: () => void;
}

/**
 * 项目详情面板。待办窗口与笔记窗口共用：
 * 进入时只展示对应那一类内容（笔记只看笔记、待办只看待办），不做 Tab 切换。
 * 笔记页头部精简：无返回按钮/类型图标/数量，单列双列切换并入标题栏。
 */
export function ProjectDetail({ projectId, feature, onBack }: ProjectDetailProps) {
	const t = useTranslations("project");
	const storeSelectedId = useUiStore((s) => s.selectedProjectId);
	const storeFeature = useUiStore((s) => s.projectDetailFeature);
	const id = projectId ?? storeSelectedId;
	const mode = feature ?? storeFeature;

	const { data: project, isLoading } = useProject(id);
	const { updateProjectAsync, deleteProjectAsync, removeTodo, removeNote } =
		useProjectMutations();

	const [notesView, setNotesView] = useState<"double" | "single">("single");
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [editDesc, setEditDesc] = useState("");
	const [managerOpen, setManagerOpen] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	if (!id) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
				<FolderKanban className="h-8 w-8 opacity-40" />
				<p className="text-sm">{t("noneSelected")}</p>
			</div>
		);
	}

	if (isLoading || !project) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("loading")}
			</div>
		);
	}

	const startEdit = () => {
		setEditName(project.name);
		setEditDesc(project.description ?? "");
		setEditing(true);
	};

	const saveEdit = async () => {
		const name = editName.trim();
		if (!name) return;
		await updateProjectAsync({
			id: project.id,
			input: { name, description: editDesc },
		});
		setEditing(false);
	};

	const handleDelete = async () => {
		await deleteProjectAsync(project.id);
		setConfirmDelete(false);
		// 项目已删除，清除选中态，避免面板停留在「加载中」
		useUiStore.setState({ selectedProjectId: null });
	};

	const todos = project.todos ?? [];
	const notes = project.notes ?? [];
	const isTodo = mode === "todo";

	// 单列/双列切换（笔记页）
	const NotesViewToggle = notes.length > 0 ? (
		<div className="flex items-center gap-0.5 rounded-md border border-border/40 p-0.5">
			<button
				type="button"
				onClick={() => setNotesView("single")}
				title={t("viewSingle")}
				className={cn(
					"flex h-6 w-6 items-center justify-center rounded transition-colors",
					notesView === "single"
						? "bg-primary/10 text-primary"
						: "text-muted-foreground hover:bg-muted/40",
				)}
			>
				<Rows2 className="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onClick={() => setNotesView("double")}
				title={t("viewDouble")}
				className={cn(
					"flex h-6 w-6 items-center justify-center rounded transition-colors",
					notesView === "double"
						? "bg-primary/10 text-primary"
						: "text-muted-foreground hover:bg-muted/40",
				)}
			>
				<Columns2 className="h-3.5 w-3.5" />
			</button>
		</div>
	) : null;

	return (
		<div className="flex h-full flex-col">
			{/* 标题栏：项目名 + 编辑/删除 +（笔记页）单列双列切换 + 管理 */}
			<div
				className="shrink-0 border-b border-border/40 p-4"
				style={
					project.color
						? {
								backgroundImage: `linear-gradient(135deg, ${project.color}22, transparent)`,
							}
						: undefined
				}
			>
				{editing ? (
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="h-8 flex-1 rounded-md border border-border/60 bg-background px-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
							/>
							<button
								type="button"
								onClick={saveEdit}
								className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
							>
								<Check className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={() => setEditing(false)}
								className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted/40"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<textarea
							value={editDesc}
							onChange={(e) => setEditDesc(e.target.value)}
							placeholder={t("descPlaceholder")}
							rows={2}
							className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
				) : (
					<div className="flex items-start gap-2">
						{onBack && (
							<button
								type="button"
								onClick={onBack}
								title={t("back")}
								className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40"
							>
								<ArrowLeft className="h-4 w-4" />
							</button>
						)}
						<FolderKanban
							className="mt-0.5 h-5 w-5 shrink-0"
							style={{ color: project.color ?? undefined }}
						/>
						<div className="min-w-0 flex-1">
							<h2 className="truncate text-base font-semibold">
								{project.name}
							</h2>
							{project.description && (
								<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
									{project.description}
								</p>
							)}
						</div>
						<div className="flex shrink-0 items-center gap-1.5">
							{!isTodo && NotesViewToggle}
							{!isTodo && (
								<button
									type="button"
									onClick={() => setManagerOpen(true)}
									className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40"
								>
									{t("manageNotes")}
								</button>
							)}
							<button
								type="button"
								onClick={startEdit}
								className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted/40"
								title={t("edit")}
							>
								<Pencil className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
								title={t("delete")}
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				)}
			</div>

			{/* 列表主体：只展示当前类型 */}
			<div className="flex-1 overflow-y-auto p-2">
				{isTodo
					? todos.length === 0 ? (
							<p className="px-3 py-6 text-center text-xs text-muted-foreground">
								{t("emptyTodos")}
							</p>
						) : (
							todos.map((td) => (
								<div
									key={td.id}
									className="group flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted/30"
								>
									<ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
									<span className="min-w-0 flex-1 truncate">{td.name}</span>
									{td.status && STATUS_LABEL[td.status] && (
										<span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
											{STATUS_LABEL[td.status]}
										</span>
									)}
									<button
										type="button"
										onClick={() => removeTodo({ id: project.id, todoId: td.id })}
										className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
										title={t("remove")}
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							))
						)
					: notes.length === 0 ? (
							<p className="px-3 py-6 text-center text-xs text-muted-foreground">
								{t("emptyNotes")}
							</p>
						) : (
							<div
								className={
									notesView === "double"
										? "columns-2 gap-2 [&>*]:mb-2 [&>*]:break-inside-avoid"
										: "space-y-2"
								}
							>
								{notes.map((n) => (
									<div
										key={n.id}
										className="group relative w-full rounded-xl border border-border/30 bg-card px-4 py-3 transition-all hover:border-border/60 hover:bg-muted/[0.02]"
									>
										{n.name && (
											<div className="mb-1 truncate text-[10px] text-muted-foreground/50">
												{n.name}
											</div>
										)}
										<div className="text-xs text-muted-foreground leading-relaxed">
											<NoteMarkdown content={n.preview || ""} />
										</div>
										<button
											type="button"
											onClick={() =>
												removeNote({ id: project.id, journalId: n.id })
											}
											className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
											title={t("remove")}
										>
											<X className="h-3 w-3" />
										</button>
									</div>
								))}
							</div>
						)}
			</div>

			{/* 管理成员弹层：按当前类型打开对应管理器 */}
			{managerOpen && isTodo && (
				<ProjectTodoManager
					projectId={project.id}
					memberIds={todos.map((td) => td.id)}
					onClose={() => setManagerOpen(false)}
				/>
			)}
			{managerOpen && !isTodo && (
				<ProjectNoteManager
					projectId={project.id}
					memberIds={notes.map((n) => n.id)}
					onClose={() => setManagerOpen(false)}
				/>
			)}

			{/* 删除确认 */}
			{confirmDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-sm rounded-(--radius) bg-background p-4 shadow-xl">
						<h3 className="text-sm font-semibold">{t("deleteConfirmTitle")}</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							{t("deleteConfirmDesc")}
						</p>
						<div className="mt-3 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
							>
								{t("cancel")}
							</button>
							<button
								type="button"
								onClick={handleDelete}
								className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90"
							>
								{t("delete")}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
