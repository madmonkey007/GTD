"use client";

import { Calendar, CalendarDays, ListTodo, Tag, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTodos } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

const FILTER_ITEMS = [
	{ id: "today" as const, label: "今天", icon: Calendar },
	{ id: "last7days" as const, label: "最近7天", icon: CalendarDays },
	{ id: "list" as const, label: "全部清单", icon: ListTodo },
] as const;

export function FilterColumn() {
	const { sidebarMode, sidebarTag, setSidebarMode, setSidebarTag, sidebarWidth, setSidebarWidth } = useUiStore();
	const { data: allTodos } = useTodos({ limit: 2000 });
	const containerRef = useRef<HTMLDivElement>(null);
	const [isResizing, setIsResizing] = useState(false);

	const allTags = useMemo(() => {
		if (!allTodos || !Array.isArray(allTodos)) return [];
		return Array.from(
			new Set(allTodos.flatMap((t: { tags?: string[] }) => t.tags || [])),
		).sort() as string[];
	}, [allTodos]);

	// 计算各个筛选条件的待办数量（只统计未完成的待办项）
	const counts = useMemo(() => {
		if (!allTodos || !Array.isArray(allTodos)) {
			return { today: 0, last7days: 0, list: 0, tags: {} as Record<string, number> };
		}
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const sevenDaysAgo = new Date(today);
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

		// 只统计未完成的待办
		const activeTodos = (allTodos as Array<{ startTime?: string | null; endTime?: string | null; tags?: string[]; status?: string }>).filter(t => t.status !== "completed");

		let todayCount = 0;
		let last7Count = 0;
		const tagCount: Record<string, number> = {};

		for (const t of activeTodos) {
			const scheduleTime = t.startTime ?? t.endTime;
			if (scheduleTime) {
				const deadline = new Date(scheduleTime);
				const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

				if (deadlineDate.getTime() === today.getTime()) todayCount++;
				if (deadlineDate >= sevenDaysAgo && deadlineDate <= today) last7Count++;
			}
			for (const tag of t.tags || []) {
				tagCount[tag] = (tagCount[tag] || 0) + 1;
			}
		}

		return { today: todayCount, last7days: last7Count, list: activeTodos.length, tags: tagCount };
	}, [allTodos]);

	const isFilterActive = sidebarMode !== null || sidebarTag !== null;

	const handleResizePointerDown = (e: React.PointerEvent) => {
		e.preventDefault();
		setIsResizing(true);
		const startX = e.clientX;
		const startWidth = containerRef.current?.offsetWidth ?? sidebarWidth;

		const handlePointerMove = (ev: PointerEvent) => {
			const newWidth = Math.max(140, Math.min(400, startWidth + ev.clientX - startX));
			setSidebarWidth(newWidth);
		};

		const handlePointerUp = () => {
			setIsResizing(false);
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerup", handlePointerUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};

		document.addEventListener("pointermove", handlePointerMove);
		document.addEventListener("pointerup", handlePointerUp);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	};

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative flex flex-col overflow-hidden shrink-0 border-r border-border/40 bg-background",
				isResizing && "pointer-events-none",
			)}
			style={{ width: sidebarWidth }}
		>
			{/* 头部 */}
			<div className="flex h-10 items-center justify-between px-3 border-b border-border/20">
				<span className="text-xs font-medium text-muted-foreground">筛选</span>
				{isFilterActive && (
					<button
						type="button"
						onClick={() => { setSidebarMode(null); setSidebarTag(null); }}
						title="清除筛选"
						className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
					>
						<X className="h-3 w-3" />
					</button>
				)}
			</div>

			{/* 筛选选项 */}
			<div className="flex flex-col gap-0.5 p-2">
				{FILTER_ITEMS.map((item) => {
					const Icon = item.icon;
					const isActive = sidebarMode === item.id || (item.id === "list" && sidebarMode === null);
					const count = counts[item.id];
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => setSidebarMode(sidebarMode === item.id ? null : item.id)}
							className={cn(
								"flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
								"hover:bg-muted/40",
								isActive
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground",
							)}
						>
							<Icon className="h-3.5 w-3.5 shrink-0" />
							<span className="flex-1 text-left">{item.label}</span>
							<span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
								{count}
							</span>
						</button>
					);
				})}
			</div>

			{/* 标签区域 */}
			{allTags.length > 0 && (
				<div className="flex flex-col gap-0.5 border-t border-border/20 px-2 pt-2 mt-1">
					<span className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
						标签
					</span>
					{allTags.map((tag) => (
						<button
							key={tag}
							type="button"
							onClick={() => setSidebarTag(sidebarTag === tag ? null : tag)}
							className={cn(
								"flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
								"hover:bg-muted/40",
								sidebarTag === tag
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground",
							)}
						>
							<Tag className="h-3 w-3 shrink-0" />
							<span className="flex-1 truncate text-left">{tag}</span>
							<span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
								{counts.tags[tag] ?? 0}
							</span>
						</button>
					))}
				</div>
			)}

			{/* 调整大小手柄 */}
			<div
				className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
				onPointerDown={handleResizePointerDown}
			/>
		</div>
	);
}