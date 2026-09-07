"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { customFetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";

/**
 * 标签 "..." 菜单弹层：点击标签右侧的 ... 按钮后出现，
 * 编辑直接展示输入框（含当前名称，Enter 提交 / Escape 取消），
 * 删除需二次确认。编辑与删除均为全局操作（影响所有带该标签的笔记）。
 */
export function TagMenuPopup({
	tagName,
	locale,
	anchorRect,
	onClose,
}: {
	tagName: string;
	locale: string;
	anchorRect: DOMRect;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<"menu" | "edit" | "confirm-delete">("menu");
	const [name, setName] = useState(tagName);
	const [busy, setBusy] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const isZh = locale === "zh";

	useEffect(() => {
		const onDown = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
	};

	const renameTag = async (newName: string) => {
		const trimmed = newName.trim();
		if (!trimmed || trimmed === tagName) {
			onClose();
			return;
		}
		setBusy(true);
		try {
			await customFetcher(`/api/journals/tags/${encodeURIComponent(tagName)}`, {
				method: "PUT",
				data: { tagName: trimmed },
			});
			toast(isZh ? "标签已更新" : "Tag updated");
			invalidate();
		} catch {
			toast(isZh ? "操作失败" : "Operation failed", { type: "warning" });
		} finally {
			setBusy(false);
			onClose();
		}
	};

	const deleteTag = async () => {
		setBusy(true);
		try {
			await customFetcher(`/api/journals/tags/${encodeURIComponent(tagName)}`, {
				method: "DELETE",
			});
			toast(isZh ? "标签已删除" : "Tag deleted");
			invalidate();
		} catch {
			toast(isZh ? "操作失败" : "Operation failed", { type: "warning" });
		} finally {
			setBusy(false);
			onClose();
		}
	};

	const top = anchorRect.bottom + 4;
	const left = Math.min(anchorRect.left, window.innerWidth - 180);

	return (
		<div
			ref={rootRef}
			role="menu"
			style={{ position: "fixed", top, left, zIndex: 9999 }}
			className="min-w-[160px] overflow-hidden rounded-lg border border-border/60 bg-background p-1.5 shadow-md"
		>
			{mode === "edit" ? (
				<div className="flex flex-col gap-1.5 p-1">
					<span className="text-[11px] text-muted-foreground">{isZh ? "编辑标签" : "Edit tag"}</span>
					<input
						ref={(el) => {
							el?.focus({ preventScroll: true });
							el?.select();
						}}
						value={name}
						disabled={busy}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								void renameTag(name);
							}
						}}
						className="w-full rounded border border-primary/40 bg-background px-2 py-1.5 text-xs focus-visible:outline-none"
					/>
					<div className="flex justify-end gap-1.5">
						<button
							type="button"
							disabled={busy}
							onClick={onClose}
							className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
						>
							{isZh ? "取消" : "Cancel"}
						</button>
						<button
							type="button"
							disabled={busy || !name.trim()}
							onClick={() => void renameTag(name)}
							className="rounded bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							{isZh ? "保存" : "Save"}
						</button>
					</div>
				</div>
			) : mode === "confirm-delete" ? (
				<div className="flex flex-col gap-2 p-1">
					<span className="text-xs text-foreground">
						{isZh ? `删除标签「${tagName}」？` : `Delete tag "${tagName}"?`}
					</span>
					<span className="text-[11px] text-muted-foreground">
						{isZh ? "将从所有笔记中移除该标签。" : "It will be removed from all notes."}
					</span>
					<div className="flex justify-end gap-1.5">
						<button
							type="button"
							disabled={busy}
							onClick={onClose}
							className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
						>
							{isZh ? "取消" : "Cancel"}
						</button>
						<button
							type="button"
							role="menuitem"
							disabled={busy}
							onClick={() => void deleteTag()}
							className="rounded bg-destructive px-2.5 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
						>
							{isZh ? "删除" : "Delete"}
						</button>
					</div>
				</div>
			) : (
				<>
					<button
						type="button"
						role="menuitem"
						disabled={busy}
						onClick={() => setMode("edit")}
						className="flex w-full items-center rounded px-2 py-1.5 text-xs hover:bg-muted/40 transition-colors"
					>
						<Pencil className="h-3.5 w-3.5 mr-2" />
						{isZh ? "编辑" : "Edit"}
					</button>
					<button
						type="button"
						role="menuitem"
						disabled={busy}
						onClick={() => setMode("confirm-delete")}
						className="flex w-full items-center rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
					>
						<Trash2 className="h-3.5 w-3.5 mr-2" />
						{isZh ? "删除" : "Delete"}
					</button>
				</>
			)}
		</div>
	);
}
