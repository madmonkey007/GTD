"use client";

import { ChevronDown, Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PanelActionButton } from "@/components/common/layout/PanelHeader";
import type { Todo, TodoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DueTimeFilter =
	| "all"
	| "overdue"
	| "today"
	| "tomorrow"
	| "thisWeek"
	| "thisMonth"
	| "future"
	| "last7Days";

export interface TodoFilterState {
	status: TodoStatus | "all";
	tag: string | "all";
	dueTime: DueTimeFilter;
}

interface TodoFilterProps {
	todos: Todo[];
	filter: TodoFilterState;
	onFilterChange: (filter: TodoFilterState) => void;
}

export function TodoFilter({ todos, filter, onFilterChange }: TodoFilterProps) {
	const tTodoList = useTranslations("todoList");
	const [isOpen, setIsOpen] = useState(false);
	const filterContainerRef = useRef<HTMLDivElement>(null);

	const allTags = Array.from(
		new Set(todos.flatMap((todo) => todo.tags || [])),
	).sort();

	const isFilterActive =
		filter.status !== "all" || filter.tag !== "all" || filter.dueTime !== "all";

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				filterContainerRef.current &&
				!filterContainerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
	}, [isOpen]);

	const handleStatusChange = (status: TodoStatus | "all") => {
		onFilterChange({ ...filter, status });
	};

	const handleTagChange = (tag: string | "all") => {
		onFilterChange({ ...filter, tag });
	};

	const handleDueTimeChange = (dueTime: DueTimeFilter) => {
		onFilterChange({ ...filter, dueTime });
	};

	const handleClearFilters = () => {
		onFilterChange({
			status: "all",
			tag: "all",
			dueTime: "all",
		});
	};

	const quickTimeOptions: { value: DueTimeFilter; label: string }[] = [
		{ value: "today", label: tTodoList("dueTimeToday") },
		{ value: "tomorrow", label: tTodoList("dueTimeTomorrow") },
		{ value: "thisWeek", label: tTodoList("dueTimeThisWeek") },
	];

	const allTimeOptions: { value: DueTimeFilter; label: string }[] = [
		{ value: "all", label: tTodoList("filterAll") },
		{ value: "overdue", label: tTodoList("dueTimeOverdue") },
		{ value: "today", label: tTodoList("dueTimeToday") },
		{ value: "tomorrow", label: tTodoList("dueTimeTomorrow") },
		{ value: "thisWeek", label: tTodoList("dueTimeThisWeek") },
		{ value: "thisMonth", label: tTodoList("dueTimeThisMonth") },
		{ value: "future", label: tTodoList("dueTimeFuture") },
	];

	const statusOptions: { value: TodoStatus | "all"; label: string }[] = [
		{ value: "all", label: tTodoList("filterAll") },
		{ value: "active", label: tTodoList("statusActive") },
		{ value: "completed", label: tTodoList("statusCompleted") },
		{ value: "canceled", label: tTodoList("statusCanceled") },
		{ value: "draft", label: tTodoList("statusDraft") },
	];

	const commonStatusOptions: { value: TodoStatus; label: string }[] = [
		{ value: "active", label: tTodoList("statusActive") },
		{ value: "completed", label: tTodoList("statusCompleted") },
	];

	return (
		<div ref={filterContainerRef} className="relative">
			<PanelActionButton
				variant="default"
				icon={Filter}
				onClick={() => setIsOpen(!isOpen)}
				iconOverrides={{
					color: isFilterActive ? "text-primary" : "text-muted-foreground",
				}}
				buttonOverrides={{
					hoverTextColor: "hover:text-foreground",
				}}
				aria-label={tTodoList("filter")}
			/>
			{isOpen && (
				<div className="absolute right-0 top-8 z-50 w-56 rounded-xl border border-border/30 bg-background shadow-lg p-4 space-y-4">
					{/* Due Time Quick Filters */}
					<div className="space-y-2">
						<div className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">
							{tTodoList("filterDueTime")}
						</div>
						<div className="flex flex-wrap gap-1.5">
							{quickTimeOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() => handleDueTimeChange(option.value)}
									className={cn(
										"px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200",
										filter.dueTime === option.value
											? "bg-primary/10 text-primary border border-primary/15"
											: "bg-muted/20 text-muted-foreground/70 border border-transparent hover:bg-muted/40 hover:text-foreground",
									)}
								>
									{option.label}
								</button>
							))}
						</div>
						<div className="relative">
							<select
								value={filter.dueTime}
								onChange={(e) =>
									handleDueTimeChange(e.target.value as DueTimeFilter)
								}
								className="w-full h-8 appearance-none rounded-lg border border-border/30 bg-background px-2.5 pr-8 text-xs text-foreground focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] focus:outline-none transition-all duration-200"
							>
								{allTimeOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
							<ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
						</div>
					</div>

					{/* Status Quick Filters */}
					<div className="space-y-2">
						<div className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">
							{tTodoList("filterStatus")}
						</div>
						<div className="flex flex-wrap gap-1.5">
							{commonStatusOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() => handleStatusChange(option.value)}
									className={cn(
										"px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200",
										filter.status === option.value
											? "bg-primary/10 text-primary border border-primary/15"
											: "bg-muted/20 text-muted-foreground/70 border border-transparent hover:bg-muted/40 hover:text-foreground",
									)}
								>
									{option.label}
								</button>
							))}
						</div>
						<div className="relative">
							<select
								value={filter.status}
								onChange={(e) =>
									handleStatusChange(e.target.value as TodoStatus | "all")
								}
								className="w-full h-8 appearance-none rounded-lg border border-border/30 bg-background px-2.5 pr-8 text-xs text-foreground focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] focus:outline-none transition-all duration-200"
							>
								{statusOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
							<ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
						</div>
					</div>

					{/* Tag Filter */}
					{allTags.length > 0 && (
						<div className="space-y-2">
							<div className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide">
								{tTodoList("filterTag")}
							</div>
							<div className="relative">
								<select
									value={filter.tag}
									onChange={(e) => handleTagChange(e.target.value)}
									className="w-full h-8 appearance-none rounded-lg border border-border/30 bg-background px-2.5 pr-8 text-xs text-foreground focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] focus:outline-none transition-all duration-200"
								>
									<option value="all">{tTodoList("filterAll")}</option>
									{allTags.map((tag) => (
										<option key={tag} value={tag}>
											{tag}
										</option>
									))}
								</select>
								<ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
							</div>
						</div>
					)}

					{/* Clear Filters Button */}
					{isFilterActive && (
						<button
							type="button"
							onClick={handleClearFilters}
							className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border/30 bg-background text-xs font-medium text-muted-foreground/70 hover:bg-muted/20 hover:text-foreground transition-all duration-200"
						>
							<X className="h-3.5 w-3.5" />
							{tTodoList("clearFilters")}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
