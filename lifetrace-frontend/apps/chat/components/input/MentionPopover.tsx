"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FolderKanban, Search, ListTodo, X } from "lucide-react";
import { useJournals, useProjects, useTodos } from "@/lib/query";
import { useNoteChatStore } from "@/lib/store/note-chat-store";
import { useTodoStore } from "@/lib/store/todo-store";
import type { JournalView } from "@/lib/query/journals";
import type { Todo } from "@/lib/types";

/** useProjects 返回的项目形状（与 ProjectView 兼容的最小字段） */
type MentionProject = {
	id: number;
	name: string;
};

/**
 * 提及浮层：点击输入框 @ 按钮后弹出，按名称/内容搜索待办、笔记、项目。
 * 选中待办会关联到 chat 上下文（与 LinkedTodos 一致），
 * 选中笔记/项目会写入关联笔记 store（与 LinkedNotes 一致，随消息发送给 AI）。
 */
export function MentionPopover({
	open,
	onClose,
	onInsert,
	locale,
}: {
	open: boolean;
	onClose: () => void;
	onInsert: (text: string, caretPos: number) => void;
	locale: string;
}) {
	const t = useTranslations("chat");
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const { data: journalsData } = useJournals({ limit: 100 });
	const { data: projectsData } = useProjects();
	const { data: todos = [] } = useTodos();

	const toggleTodoSelection = useTodoStore((s) => s.toggleTodoSelection);
	const addLinkedNote = useNoteChatStore((s) => s.addLinkedNote);
	const linkedNotes = useNoteChatStore((s) => s.linkedNotes);

	// 打开时自动聚焦搜索框；关闭时清空搜索词
	useEffect(() => {
		if (!open) return;
		setQuery("");
		const timer = setTimeout(() => inputRef.current?.focus(), 0);
		return () => clearTimeout(timer);
	}, [open]);

	// 点击浮层外部关闭；Esc 关闭
	useEffect(() => {
		if (!open) return;
		const handleClickOutside = (e: MouseEvent) => {
			const el = e.target as HTMLElement;
			if (!el.closest("[data-mention-popover]")) {
				onClose();
			}
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown, true);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [open, onClose]);

	const q = query.trim().toLowerCase();
	const match = (s: string) => s.toLowerCase().includes(q);

	const filteredTodos = useMemo(
		() => (q ? todos.filter((todo) => match(todo.name)) : todos),
		[todos, q],
	);
	const filteredJournals = useMemo(
		() =>
			q
				? journalsData?.journals.filter(
						(n) => match(n.name) || match(n.userNotes),
					)
				: journalsData?.journals,
		[journalsData, q],
	);
	const filteredProjects = useMemo(
		() => (q ? projectsData?.filter((p) => match(p.name)) : projectsData),
		[projectsData, q],
	);

	// 点击待办：关联到 chat 上下文（同 LinkedTodos）
	const handleTodoClick = (todo: Todo) => {
		toggleTodoSelection(todo.id);
		onInsert(`@${todo.name} `, todo.name.length + 2);
	};

	// 点击笔记：写入关联笔记 store（随消息发送给 AI）
	const handleNoteClick = (note: JournalView) => {
		if (!linkedNotes.some((n) => n.id === note.id)) {
			addLinkedNote({
				id: note.id,
				name: note.name,
				userNotes: note.userNotes,
				date: note.date,
				tags: note.tags.map((tag) => tag.tagName),
			});
		}
		onInsert(`@${note.name} `, note.name.length + 2);
	};

	// 点击项目：写入关联笔记 store（把项目作为一篇笔记附加上下文）
	const handleProjectClick = (project: MentionProject) => {
		if (!linkedNotes.some((n) => n.id === project.id)) {
			addLinkedNote({
				id: project.id,
				name: project.name,
				userNotes: "",
				date: "",
				tags: [],
			});
		}
		onInsert(`@${project.name} `, project.name.length + 2);
	};

	if (!open) return null;

	const hasTodos = filteredTodos.length > 0;
	const hasJournals = (filteredJournals ?? []).length > 0;
	const hasProjects = (filteredProjects ?? []).length > 0;

	return (
		<div
			data-mention-popover
			className="absolute left-0 bottom-full z-50 mb-2 w-80 max-h-80 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
		>
			{/* 标题栏 */}
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<span className="text-sm font-medium">
					{t("mention.title")}
				</span>
				<button
					type="button"
					onClick={onClose}
					className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-foreground/5"
					aria-label={t("mention.close")}
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			{/* 搜索框 */}
			<div className="border-b border-border px-3 py-2">
				<div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-2 py-1">
					<Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") onClose();
						}}
						placeholder={t("mention.searchPlaceholder")}
						className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
					/>
				</div>
			</div>

			{/* 列表 */}
			<div className="flex-1 overflow-y-auto p-2">
				{/* 待办分区 */}
				{hasTodos && (
					<div className="mb-3">
						<div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
							<ListTodo className="h-3.5 w-3.5" />
							{t("mention.todos")}
						</div>
						<div className="space-y-0.5">
							{filteredTodos.map((todo) => (
								<button
									key={todo.id}
									type="button"
									data-mention-item
									onClick={() => handleTodoClick(todo)}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
								>
									<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
									<span className="flex-1 truncate text-left">{todo.name}</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* 笔记分区 */}
				{hasJournals && (
					<div className="mb-3">
						<div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
							<FileText className="h-3.5 w-3.5" />
							{t("mention.notes")}
						</div>
						<div className="space-y-0.5">
							{filteredJournals?.map((note) => (
								<button
									key={note.id}
									type="button"
									data-mention-item
									onClick={() => handleNoteClick(note)}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
								>
									<FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
									<span className="flex-1 truncate text-left">
										{note.name || (locale === "zh" ? "未命名笔记" : "Untitled note")}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* 项目分区 */}
				{hasProjects && (
					<div>
						<div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
							<FolderKanban className="h-3.5 w-3.5" />
							{t("mention.projects")}
						</div>
						<div className="space-y-0.5">
							{filteredProjects?.map((project) => (
								<button
									key={project.id}
									type="button"
									data-mention-item
									onClick={() => handleProjectClick(project)}
									className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
								>
									<FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
									<span className="flex-1 truncate text-left">{project.name}</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* 空态 */}
				{!hasTodos && !hasJournals && !hasProjects && (
					<p className="px-2 py-6 text-center text-xs text-muted-foreground">
						{q ? t("mention.noResults") : t("mention.empty")}
					</p>
				)}
			</div>
		</div>
	);
}
