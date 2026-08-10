"use client";

import {
	ArrowLeft,
	Check,
	Columns2,
	FolderKanban,
	ListTodo,
	Pencil,
	Rows2,
	StickyNote,
	Trash2,
	X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
	/** 可选：提供返回回调时，在头部显示返回按钮（内联/移动端场景使用） */
	onBack?: () => void;
}

type Tab = "todos" | "notes";

/** 项目详情面板：待办 + 笔记双 Tab。头部可编辑、管理成员、删除。 */
export function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
	const t = useTranslations("project");
	const storeSelectedId = useUiStore((s) => s.selectedProjectId);
	const id = projectId ?? storeSelectedId;

	const { data: project, isLoading } = useProject(id);
	const { updateProjectAsync, deleteProjectAsync, removeTodo, removeNote } =
		useProjectMutations();

	const [tab, setTab] = useState<Tab>("todos");
	const [notesView, setNotesView] = useState<"single" | "double">("single");
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [editDesc, setEditDesc] = useState("");
	const [manager, setManager] = useState<null | "todo" | "note">(null);
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

	return (
		<div className="flex h-full flex-col">
			{/* 头部 */}
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
							<p className="mt-1 text-[11px] text-muted-foreground/70">
								{project.todoCount} {t("todoUnit")} · {project.noteCount}{" "}
								{t("noteUnit")}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-1">
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

			{/* Tab 切换 + 管理按钮 */}
			<div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2">
				{onBack && (
					<button
						type="button"
						onClick={onBack}
						title={t("back")}
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40"
					>
						<ArrowLeft className="h-4 w-4" />
					</button>
				)}
				<div className="flex items-center gap-0.5 rounded-md border border-border/40 p-0.5 text-xs">
					<button
						type="button"
						onClick={() => setTab("todos")}
						className={cn(
							"flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors",
							tab === "todos"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-muted/40",
						)}
					>
						<ListTodo className="h-3 w-3" />
						{t("tabTodos")}
						<span className="tabular-nums">{project.todoCount}</span>
					</button>
					<button
						type="button"
						onClick={() => setTab("notes")}
						className={cn(
							"flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors",
							tab === "notes"
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-muted/40",
						)}
					>
						<StickyNote className="h-3 w-3" />
						{t("tabNotes")}
						<span className="tabular-nums">{project.noteCount}</span>
					</button>
				</div>
				<div className="flex-1" />
				{tab === "notes" && notes.length > 0 && (
					<div className="mr-1 flex items-center gap-0.5 rounded-md border border-border/40 p-0.5">
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
				)}
				<button
					type="button"
					onClick={() => setManager(tab === "todos" ? "todo" : "note")}
					className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40"
				>
					{tab === "todos" ? t("manageTodos") : t("manageNotes")}
				</button>
			</div>

			{/* 列表主体 */}
			<div className="flex-1 overflow-y-auto p-2">
				{tab === "todos" ? (
					todos.length === 0 ? (
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
				) : notes.length === 0 ? (
					<p className="px-3 py-6 text-center text-xs text-muted-foreground">
						{t("emptyNotes")}
					</p>
				) : (
					<div
						className={cn(
							"grid gap-2",
							notesView === "double" ? "grid-cols-2" : "grid-cols-1",
						)}
					>
						{notes.map((n) => (
							<div
								key={n.id}
								className="group relative flex flex-col gap-1.5 rounded-(--radius) bg-[oklch(var(--card))] p-3 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] transition-all hover:bg-muted/30"
							>
								<StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
								<p
									className={cn(
										"text-sm leading-relaxed text-foreground/80",
										notesView === "double" ? "line-clamp-4" : "line-clamp-3",
									)}
								>
									{n.preview || t("emptyNote")}
								</p>
								<div className="mt-auto truncate text-[11px] text-muted-foreground/60">
									{n.name}
									{n.date ? ` · ${n.date.slice(0, 10)}` : ""}
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

			{/* 管理成员弹层 */}
			{manager === "todo" && (
				<ProjectTodoManager
					projectId={project.id}
					memberIds={todos.map((td) => td.id)}
					onClose={() => setManager(null)}
				/>
			)}
			{manager === "note" && (
				<ProjectNoteManager
					projectId={project.id}
					memberIds={notes.map((n) => n.id)}
					onClose={() => setManager(null)}
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
