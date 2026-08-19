"use client";

import { Archive, Calendar, CalendarDays, ChevronDown, ChevronRight, Inbox, Tag, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { ProjectList } from "@/apps/project";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useTodos } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

const FILTER_ITEMS = [
	{ id: "today" as const, label: "今天", icon: Calendar },
	{ id: "last7days" as const, label: "最近7天", icon: CalendarDays },
	{ id: "inbox" as const, label: "收集箱", icon: Inbox },
] as const;

export function FilterColumn({ widthOverride }: { widthOverride?: string }) {
	const t = useTranslations("todoList");
	const { sidebarMode, sidebarTag, setSidebarMode, setSidebarTag, sidebarWidth, setSidebarWidth, todoProjectFilter, setTodoProjectFilter } = useUiStore();
	const { data: allTodos } = useTodos({ limit: 2000 });
	const containerRef = useRef<HTMLDivElement>(null);
	const [isResizing, setIsResizing] = useState(false);
	const [tagsExpanded, setTagsExpanded] = useState(true);
	const isMobile = useIsMobile();

	const allTags = useMemo(() => {
		if (!allTodos || !Array.isArray(allTodos)) return [];
		return Array.from(
			new Set(allTodos.flatMap((t: { tags?: string[] }) => t.tags || [])),
		).sort() as string[];
	}, [allTodos]);

	// 计算各个筛选条件的待办数量（只统计未完成的待办项）
	const counts = useMemo(() => {
		if (!allTodos || !Array.isArray(allTodos)) {
			return { today: 0, last7days: 0, inbox: 0, tags: {} as Record<string, number> };
		}
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const sevenDaysAgo = new Date(today);
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

		// 只统计未完成的待办（排除子待办，收集箱只计父级）
		const activeTodos = (allTodos as Array<{ startTime?: string | null; endTime?: string | null; tags?: string[]; status?: string; isInbox?: boolean; parentTodoId?: number | null }>).filter(t => t.status !== "completed" && !t.parentTodoId);

		let todayCount = 0;
		let last7Count = 0;
		let inboxCount = 0;
		const tagCount: Record<string, number> = {};

		for (const t of activeTodos) {
			if (t.isInbox === true) inboxCount++;
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

		return { today: todayCount, last7days: last7Count, inbox: inboxCount, tags: tagCount };
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
				"relative flex flex-col overflow-y-auto overflow-x-hidden shrink-0 border-r border-border/40 bg-background",
				isMobile && "h-full",
				isResizing && "pointer-events-none",
			)}
			style={{
				width: widthOverride ?? sidebarWidth,
				paddingBottom: isMobile
					? "max(env(safe-area-inset-bottom), 0.75rem)"
					: undefined,
			}}
		>
			{/* 头部 */}
			<div
				className={cn(
					"flex items-center justify-between px-3 border-b border-border/40",
					isMobile ? "h-11" : "h-10",
				)}
			>
				<span className="text-xs font-medium text-muted-foreground">筛选</span>
				{isFilterActive && (
					<button
						type="button"
						onClick={() => { setSidebarMode(null); setSidebarTag(null); }}
						title="清除筛选"
						className={cn(
							"flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors",
							isMobile ? "h-9 w-9 -mr-1.5" : "h-5 w-5",
						)}
					>
						<X className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
					</button>
				)}
			</div>

			{/* 筛选选项 */}
			<div className="flex flex-col gap-0.5 p-2">
				{FILTER_ITEMS.map((item) => {
					const Icon = item.icon;
					// 全部清单：无模式筛选且未进入项目筛选时才高亮（避免与项目选中态并存）
					const isActive =
						sidebarMode === item.id ||
						(item.id === "inbox" && sidebarMode === null && !todoProjectFilter);
					const count = counts[item.id];
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => { setTodoProjectFilter(null); setSidebarMode(sidebarMode === item.id ? null : item.id); }}
							className={cn(
								"flex items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
								isMobile ? "min-h-11" : "py-1.5",
								"hover:bg-muted/40",
								isActive
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground",
							)}
						>
							<Icon className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
							<span className="flex-1 text-left">{item.label}</span>
							<span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
								{count}
							</span>
						</button>
					);
				})}
			</div>

			{/* 项目入口（待办+笔记共享容器），位于标签之上 */}
			<div className="flex flex-col gap-0.5 border-t border-border/20 px-2 pt-2 mt-1">
				<ProjectList feature="todo" />
			</div>

			{/* 标签目录：空时也保留标题入口，便于知道这里有标签体系 */}
			<div className="flex flex-col gap-0.5 border-t border-border/20 px-2 pt-2 mt-1">
				<button
					type="button"
					onClick={() => setTagsExpanded((v) => !v)}
					className={cn(
						"flex items-center gap-1 px-2.5 text-sm font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground",
						isMobile ? "min-h-11" : "pb-1",
					)}
				>
					标签
					{tagsExpanded ? (
						<ChevronDown className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
					) : (
						<ChevronRight className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
					)}
				</button>
				{tagsExpanded &&
					(allTags.length === 0 ? (
						<p className="px-2.5 py-1 text-xs text-muted-foreground/50">
							暂无标签，创建待办时添加
						</p>
					) : (
						allTags.map((tag) => (
							<button
								key={tag}
								type="button"
								onClick={() => { setTodoProjectFilter(null); setSidebarTag(sidebarTag === tag ? null : tag); }}
								className={cn(
									"flex items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
									isMobile ? "min-h-11" : "py-1.5",
									"hover:bg-muted/40",
									sidebarTag === tag
										? "bg-primary/10 text-primary font-medium"
										: "text-muted-foreground",
								)}
							>
								<Tag className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3 w-3")} />
								<span className="flex-1 truncate text-left">{tag}</span>
								<span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
									{counts.tags[tag] ?? 0}
								</span>
							</button>
						))
					))}
				</div>

				{/* 归档 / 回收站 */}
				<div className="flex flex-col gap-0.5 border-t border-border/20 px-2 pt-2 mt-1">
					{(
						[
							{ id: "archived" as const, label: t("archived"), icon: Archive },
							{ id: "trashed" as const, label: t("trashed"), icon: Trash2 },
						] as const
					).map((item) => {
						const Icon = item.icon;
						const isActive = sidebarMode === item.id;
						return (
							<button
								key={item.id}
								type="button"
								onClick={() => {
									setTodoProjectFilter(null);
									setSidebarTag(null);
									setSidebarMode(sidebarMode === item.id ? null : item.id);
								}}
								className={cn(
									"flex items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
									isMobile ? "min-h-11" : "py-1.5",
									"hover:bg-muted/40",
									isActive
										? "bg-primary/10 text-primary font-medium"
										: "text-muted-foreground",
								)}
							>
								<Icon className={cn("shrink-0", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
								<span className="flex-1 text-left">{item.label}</span>
							</button>
						);
					})}
				</div>

			{/* 调整大小手柄（移动端抽屉内无意义，隐藏） */}
			{!isMobile && (
				<div
					className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
					onPointerDown={handleResizePointerDown}
				/>
			)}
		</div>
	);
}
