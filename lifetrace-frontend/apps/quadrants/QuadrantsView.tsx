"use client";

import { useMemo } from "react";
import { useTodos } from "@/lib/query";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/utils";

type QuadrantKey = "q1" | "q2" | "q3" | "q4";

interface Quadrant {
	key: QuadrantKey;
	title: string;
	priority: "high" | "medium" | "low" | "none";
	color: string;
	bgColor: string;
}

const QUADRANTS: Quadrant[] = [
	{ key: "q1", title: "重要且紧急", priority: "high", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/20" },
	{ key: "q2", title: "重要不紧急", priority: "medium", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/20" },
	{ key: "q3", title: "紧急不重要", priority: "low", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/20" },
	{ key: "q4", title: "不紧急不重要", priority: "none", color: "text-gray-500 dark:text-gray-400", bgColor: "bg-gray-50 dark:bg-gray-900/20" },
];

function formatDeadline(todo: Todo): string | null {
	const time = todo.endTime ?? todo.startTime;
	if (!time) return null;
	const d = new Date(time);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

	if (diffDays === 0) return "今天";
	if (diffDays === 1) return "明天";
	if (diffDays === -1) return "昨天";
	if (diffDays > 0 && diffDays <= 7) return `${diffDays}天后`;
	if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}天前`;
	return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function QuadrantsView() {
	const { data: todos = [] } = useTodos();

	const activeTodos = useMemo(
		() => todos.filter((t) => t.status !== "completed"),
		[todos],
	);

	const quadrants = useMemo(() => {
		const map: Record<QuadrantKey, Todo[]> = {
			q1: [],
			q2: [],
			q3: [],
			q4: [],
		};
		for (const todo of activeTodos) {
			const priority = todo.priority ?? "none";
			const quadrant = QUADRANTS.find((q) => q.priority === priority) ?? QUADRANTS[3];
			map[quadrant.key].push(todo);
		}
		return map;
	}, [activeTodos]);

	return (
		<div className="flex h-full flex-col p-4">
			<h2 className="mb-4 text-lg font-semibold tracking-tight">四象限视图</h2>
			<div className="grid flex-1 grid-cols-2 gap-3">
				{QUADRANTS.map((quadrant) => {
					const todos = quadrants[quadrant.key];
					return (
						<div
							key={quadrant.key}
							className={cn(
								"flex flex-col overflow-hidden rounded-xl border p-3",
								quadrant.bgColor,
								"border-border/60",
							)}
						>
							<h3 className={cn("mb-2 text-sm font-semibold", quadrant.color)}>
								{quadrant.title}
								<span className="ml-2 text-xs font-normal text-muted-foreground">
									{todos.length}
								</span>
							</h3>
							<div className="flex-1 space-y-1.5 overflow-y-auto">
								{todos.length === 0 ? (
									<p className="text-xs text-muted-foreground/50">暂无任务</p>
								) : (
									todos.map((todo) => {
										const deadline = formatDeadline(todo);
										return (
											<div
												key={todo.id}
												className="rounded-lg bg-background/80 px-2.5 py-2 text-xs shadow-xs"
											>
												<p className="line-clamp-2 font-medium text-foreground">
													{todo.name}
												</p>
												{deadline && (
													<p className="mt-0.5 text-[11px] text-muted-foreground">
														{deadline}
													</p>
												)}
											</div>
										);
									})
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
