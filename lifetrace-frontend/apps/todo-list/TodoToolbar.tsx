"use client";

import { ListTodo, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
	PanelActionButton,
	usePanelIconStyle,
} from "@/components/common/layout/PanelHeader";
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
		<div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/30">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
						<ListTodo className="w-3.5 h-3.5 text-primary/60" />
					</div>
					<span className="text-sm font-semibold tracking-tight text-foreground/80">
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
									className="h-7 w-44 rounded-lg border border-border/40 bg-background px-7 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] transition-all duration-200"
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
