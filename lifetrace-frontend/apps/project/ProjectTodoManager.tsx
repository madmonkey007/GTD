"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useProjectMutations, useTodos } from "@/lib/query";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
	active: "进行中",
	completed: "已完成",
	cancelled: "已取消",
	postponed: "已推迟",
	"needs-action": "待处理",
	"in-process": "进行中",
};

interface ProjectTodoManagerProps {
	projectId: number;
	memberIds: number[];
	onClose: () => void;
}

/** 管理项目待办成员：从全部待办里勾选加入/移除。 */
export function ProjectTodoManager({
	projectId,
	memberIds,
	onClose,
}: ProjectTodoManagerProps) {
	const t = useTranslations("project");
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<"all" | "member" | "other">("all");
	const { data: todos = [] } = useTodos({ limit: 500 });
	const { addTodosAsync, removeTodo, isPending } = useProjectMutations();

	const [selected, setSelected] = useState<Set<number>>(
		() => new Set(memberIds),
	);

	const memberSet = useMemo(() => new Set(memberIds), [memberIds]);
	const memberCount = memberIds.length;

	const filtered = todos.filter((td) => {
		const matchesSearch =
			!search ||
			(td.name || "").toLowerCase().includes(search.toLowerCase()) ||
			(td.summary || "").toLowerCase().includes(search.toLowerCase());
		if (!matchesSearch) return false;
		return filter === "all"
			? true
			: filter === "member"
				? memberSet.has(td.id)
				: !memberSet.has(td.id);
	});

	const counts = useMemo(() => {
		let added = 0;
		let removed = 0;
		for (const td of todos) {
			const was = memberIds.includes(td.id);
			const now = selected.has(td.id);
			if (!was && now) added++;
			if (was && !now) removed++;
		}
		return { added, removed };
	}, [todos, selected, memberIds]);

	const toggle = (id: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleSave = async () => {
		const toAdd: number[] = [];
		const toRemove: number[] = [];
		for (const td of todos) {
			const was = memberIds.includes(td.id);
			const now = selected.has(td.id);
			if (!was && now) toAdd.push(td.id);
			if (was && !now) toRemove.push(td.id);
		}
		if (toAdd.length > 0)
			await addTodosAsync({ id: projectId, todoIds: toAdd });
		for (const tid of toRemove) removeTodo({ id: projectId, todoId: tid });
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div className="flex h-[80vh] w-full max-w-lg flex-col rounded-(--radius) bg-background shadow-xl">
				<div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
					<h3 className="text-sm font-semibold">{t("manageTodos")}</h3>
					<button
						type="button"
						onClick={onClose}
						className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/40"
						aria-label={t("close")}
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="border-b border-border/40 p-3 pb-2">
					<div className="relative">
						<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t("searchTodos")}
							className="h-8 w-full rounded-md border border-border/40 bg-background pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
						/>
					</div>
					<div className="mt-2 flex items-center gap-0.5 rounded-md border border-border/40 p-0.5 text-xs">
						{(
							[
								["all", t("filterAll")],
								["member", `${t("filterMember")} (${memberCount})`],
								["other", t("filterOther")],
							] as const
						).map(([key, label]) => (
							<button
								key={key}
								type="button"
								onClick={() => setFilter(key)}
								className={cn(
									"flex-1 rounded px-2 py-1 font-medium transition-colors",
									filter === key
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted/40",
								)}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-2">
					{filtered.length === 0 ? (
						<p className="px-3 py-6 text-center text-xs text-muted-foreground">
							{t("noCandidates")}
						</p>
					) : (
						filtered.map((td) => {
							const isMember = selected.has(td.id);
							return (
								<button
									key={td.id}
									type="button"
									onClick={() => toggle(td.id)}
									className={cn(
										"flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
										isMember
											? "bg-primary/10 text-primary"
											: "text-foreground hover:bg-muted/40",
									)}
								>
									<span
										className={cn(
											"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
											isMember
												? "border-primary bg-primary text-primary-foreground"
												: "border-border/60",
										)}
									>
										{isMember && <span className="text-[10px]">✓</span>}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">
											{td.name || t("emptyTodo")}
										</span>
										<span className="block truncate text-[11px] text-muted-foreground/60">
											{(td.summary || td.description || "")
												.replace(/[#\n]/g, " ")
												.trim() || STATUS_LABEL[td.status] || td.status}
										</span>
									</span>
								</button>
							);
						})
					)}
				</div>

				<div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-3">
					<span className="text-xs text-muted-foreground">
						{counts.added > 0 && `+${counts.added} `}
						{counts.removed > 0 && `-${counts.removed}`}
						{counts.added === 0 && counts.removed === 0 && t("noChange")}
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
						>
							{t("cancel")}
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={isPending}
							className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{t("save")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
