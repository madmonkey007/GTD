"use client";

import {
	Check,
	ChevronDown,
	List,
	LayoutGrid,
	Search,
	Sparkles,
	X,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DiarySearchBarProps {
	showLeftToggle: boolean;
	showRightToggle: boolean;
	isLeftOpen: boolean;
	isRightOpen: boolean;
	onToggleLeft?: () => void;
	onToggleRight?: () => void;
	viewMode: "single" | "double";
	setViewMode: (m: "single" | "double") => void;
	searchQuery: string;
	setSearchQuery: (v: string) => void;
	locale: string;
}

/** 左侧边栏/右聊天面板的开合按钮 */
function ToggleButton({
	label,
	active,
	onClick,
	align,
	children,
}: {
	label: string;
	active: boolean;
	onClick?: () => void;
	align: "left" | "right";
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={label}
			className={cn(
				"flex-shrink-0 transition-colors",
				active ? "text-primary" : "text-muted-foreground hover:text-foreground",
			)}
		>
			<span
				className={cn(
					"flex items-center justify-center rounded-lg p-1 transition-colors hover:bg-muted/40",
					align === "left" ? "-ml-1" : "-mr-1",
				)}
			>
				{children}
			</span>
		</button>
	);
}

export function DiarySearchBar({
	showLeftToggle,
	showRightToggle,
	isLeftOpen,
	isRightOpen,
	onToggleLeft,
	onToggleRight,
	viewMode,
	setViewMode,
	searchQuery,
	setSearchQuery,
	locale,
}: DiarySearchBarProps) {
	// 视图切换按钮
	const viewButton = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					title={
						viewMode === "single"
							? locale === "zh"
								? "单列"
								: "Single column"
							: locale === "zh"
								? "双列"
								: "Double column"
					}
					className="flex h-8 flex-shrink-0 items-center gap-1 rounded-lg border border-border/30 bg-background/50 px-2 text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground"
				>
					{viewMode === "single" ? (
						<List className="h-3.5 w-3.5" />
					) : (
						<LayoutGrid className="h-3.5 w-3.5" />
					)}
					<ChevronDown className="h-3 w-3 opacity-60" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-[120px]">
				<DropdownMenuItem onClick={() => setViewMode("single")}>
					<List className="h-3.5 w-3.5 mr-2" />
					{locale === "zh" ? "单列" : "Single column"}
					{viewMode === "single" && <Check className="h-3.5 w-3.5 ml-auto" />}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setViewMode("double")}>
					<LayoutGrid className="h-3.5 w-3.5 mr-2" />
					{locale === "zh" ? "双列" : "Double column"}
					{viewMode === "double" && <Check className="h-3.5 w-3.5 ml-auto" />}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	const searchInput = (
		<div className="relative flex-1">
			<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
			<input
				type="text"
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				placeholder="搜索笔记..."
				className="w-full h-8 rounded-lg border border-border/30 bg-background/50 pr-8 pl-8 text-xs text-foreground transition-all duration-200 placeholder:text-muted-foreground/30 focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] focus:outline-none"
			/>
			{searchQuery && (
				<button
					type="button"
					onClick={() => setSearchQuery("")}
					className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground/30 transition-colors hover:text-muted-foreground"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);

	const leftToggle = showLeftToggle && (
		<ToggleButton
			label={locale === "zh" ? "打开侧边栏" : "Toggle sidebar"}
			active={isLeftOpen}
			onClick={onToggleLeft}
			align="left"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</ToggleButton>
	);

	const rightToggle = showRightToggle && (
		<ToggleButton
			label={locale === "zh" ? "打开对话面板" : "Toggle chat"}
			active={isRightOpen}
			onClick={onToggleRight}
			align="right"
		>
			<Sparkles className="h-4 w-4" />
		</ToggleButton>
	);

	return (
		<div className="relative mx-4 mt-2 mb-2 flex items-center gap-1">
			{leftToggle}
			{viewButton}
			{searchInput}
			{rightToggle}
		</div>
	);
}
