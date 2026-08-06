"use client";

import { ListTodo, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
	PanelActionButton,
	usePanelIconStyle,
} from "@/components/common/layout/PanelHeader";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TodoFilterState } from "./components/TodoFilter";
import { TodoFilter } from "./components/TodoFilter";

interface TodoToolbarProps {
	searchQuery: string;
	onSearch: (value: string) => void;
	todos: Todo[];
	filter: TodoFilterState;
	onFilterChange: (filter: TodoFilterState) => void;
}

export function TodoToolbar({
	searchQuery,
	onSearch,
	todos,
	filter,
	onFilterChange,
}: TodoToolbarProps) {
	const tPage = useTranslations("page");
	const tTodoList = useTranslations("todoList");
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const searchContainerRef = useRef<HTMLDivElement>(null);
	const actionIconStyle = usePanelIconStyle("action");
	const isMobile = useIsMobile();

	useEffect(() => {
		if (isSearchOpen && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [isSearchOpen]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				searchContainerRef.current &&
				!searchContainerRef.current.contains(event.target as Node) &&
				!searchQuery
			) {
				setIsSearchOpen(false);
			}
		};

		if (isSearchOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
	}, [isSearchOpen, searchQuery]);

	return (
		<div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<ListTodo className="w-4 h-4 text-primary/70" />
					<span className="text-sm font-semibold tracking-tight text-foreground">
						{tPage("todoListTitle")}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<TodoFilter
						todos={todos}
						filter={filter}
						onFilterChange={onFilterChange}
					/>
					<div ref={searchContainerRef} className="relative">
						{isSearchOpen ? (
							<div className="relative">
								<Search
									className={cn(
										"absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground",
										actionIconStyle,
									)}
								/>
								<input
									ref={searchInputRef}
									type="text"
									value={searchQuery}
									onChange={(e) => onSearch(e.target.value)}
									placeholder={tTodoList("searchPlaceholder")}
									className={cn(
										"h-7 rounded-lg border border-border/40 bg-background px-7 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] transition-all duration-200",
										isMobile ? "w-36 max-w-[38vw]" : "w-44",
									)}
								/>
							</div>
						) : (
							<PanelActionButton
								variant="default"
								icon={Search}
								onClick={() => setIsSearchOpen(true)}
								iconOverrides={{ color: "text-muted-foreground" }}
								buttonOverrides={{ hoverTextColor: "hover:text-foreground" }}
								aria-label={tTodoList("searchPlaceholder")}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
