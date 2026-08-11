"use client";

import { motion } from "framer-motion";
import {
	ArrowLeft,
	FolderKanban,
	MoreHorizontal,
	Pencil,
	Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useProjectMutations } from "@/lib/query";
import type { ProjectView } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";

interface ProjectHeaderProps {
	project: ProjectView;
	/** 提供返回回调时显示返回箭头（移动端/内联场景） */
	onBack?: () => void;
	/** 标题栏右侧的管理按钮文案（如「管理笔记」/「管理待办」） */
	manageLabel?: string;
	onManageClick?: () => void;
	/** 标题栏右侧额外的操作区（如单列/双列切换） */
	renderActions?: React.ReactNode;
}

/** 项目标题栏：项目名/描述 + 编辑 + 删除 + 管理 +（可选）返回箭头与操作区。 */
export function ProjectHeader({
	project,
	onBack,
	manageLabel,
	onManageClick,
	renderActions,
}: ProjectHeaderProps) {
	const t = useTranslations("project");
	const { updateProjectAsync, deleteProjectAsync } = useProjectMutations();
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(project.name);
	const [editDesc, setEditDesc] = useState(project.description ?? "");
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [menuOpen]);

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

	return (
		<div
			className="shrink-0 border-b border-border/40 p-4"
			style={
				project.color
					? {
							backgroundImage: `linear-gradient(180deg, ${project.color}12, transparent)`,
						}
					: undefined
			}
		>
			{editing ? (
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
					<motion.span
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{
							type: "spring",
							stiffness: 100,
							damping: 20,
						}}
						className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/10"
						style={
							project.color
								? {
										backgroundColor: project.color,
										boxShadow: `0 1px 3px ${project.color}40`,
									}
								: undefined
						}
					>
						<FolderKanban
							className="h-4 w-4"
							style={{ color: project.color ? "white" : undefined }}
						/>
					</motion.span>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h2 className="truncate text-base font-semibold">
								{project.name}
							</h2>
							<span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono leading-none text-muted-foreground">
								<motion.span
									key={project.noteCount}
									initial={{ opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{
										type: "spring",
										stiffness: 100,
										damping: 20,
									}}
									className="inline-block"
								>
									{t("noteCount", { count: project.noteCount })}
								</motion.span>
							</span>
						</div>
						{project.description && (
							<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
								{project.description}
							</p>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						{renderActions}
						<div className="text-xs text-muted-foreground">
							{t("editing")}
						</div>
					</div>
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
					<motion.span
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{
							type: "spring",
							stiffness: 100,
							damping: 20,
						}}
						className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/10"
						style={
							project.color
								? {
										backgroundColor: project.color,
										boxShadow: `0 1px 3px ${project.color}40`,
									}
								: undefined
						}
					>
						<FolderKanban
							className="h-4 w-4"
							style={{ color: project.color ? "white" : undefined }}
						/>
					</motion.span>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h2 className="truncate text-base font-semibold">
								{project.name}
							</h2>
							<span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono leading-none text-muted-foreground">
								<motion.span
									key={project.noteCount}
									initial={{ opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{
										type: "spring",
										stiffness: 100,
										damping: 20,
									}}
									className="inline-block"
								>
									{t("noteCount", { count: project.noteCount })}
								</motion.span>
							</span>
						</div>
						{project.description && (
							<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
								{project.description}
							</p>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-1.5">
						{renderActions}
						<div ref={menuRef} className="relative">
							<button
								type="button"
								onClick={() => setMenuOpen((v) => !v)}
								aria-haspopup="menu"
								aria-expanded={menuOpen}
								className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-all hover:bg-muted/40 active:scale-[0.97]"
								title={t("more")}
							>
								<MoreHorizontal className="h-4 w-4" />
							</button>
							{menuOpen && (
								<div
									role="menu"
									className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-border bg-background p-1 shadow-lg"
								>
									{manageLabel && onManageClick && (
										<button
											type="button"
											role="menuitem"
											onClick={() => {
												onManageClick();
												setMenuOpen(false);
											}}
											className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
										>
											<FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
											{manageLabel}
										</button>
									)}
									<button
										type="button"
										role="menuitem"
										onClick={() => {
											startEdit();
											setMenuOpen(false);
										}}
										className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
									>
										<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
										{t("edit")}
									</button>
									<button
										type="button"
										role="menuitem"
										onClick={() => {
											setConfirmDelete(true);
											setMenuOpen(false);
										}}
										className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
									>
										<Trash2 className="h-3.5 w-3.5" />
										{t("delete")}
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

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

			{editing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-sm rounded-(--radius) bg-background p-4 shadow-xl">
						<h3 className="text-sm font-semibold">{t("editTitle")}</h3>
						<div className="mt-3 flex flex-col gap-2">
							<input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								placeholder={t("namePlaceholder")}
								autoFocus
								className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
							/>
							<textarea
								value={editDesc}
								onChange={(e) => setEditDesc(e.target.value)}
								placeholder={t("descPlaceholder")}
								rows={3}
								className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
							/>
						</div>
						<div className="mt-3 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setEditing(false)}
								className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
							>
								{t("cancel")}
							</button>
							<button
								type="button"
								onClick={saveEdit}
								disabled={!editName.trim()}
								className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
							>
								{t("save")}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
