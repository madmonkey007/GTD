"use client";

import { useEffect, useRef } from "react";
import {
	ArrowLeft,
	Check,
	History,
	LayoutGrid,
	List,
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
import { useUiStore } from "@/lib/store/ui-store";
import { useLocaleStore } from "@/lib/store/locale";
import { useMobileToolbarStore } from "@/lib/store/mobile-toolbar-store";
import type { SidebarView } from "@/lib/store/ui-store/types";
import { SIDEBAR_NAV_ITEMS } from "./SidebarNav";
import { cn } from "@/lib/utils";

/** 不在 SIDEBAR_NAV_ITEMS 中的视图 → 顶栏标题文案 */
const EXTRA_LABELS: Record<string, string> = {
	profile: "我的",
};

/** 待办/日历/四象限：移动顶栏以 tab 组形式切换 */
const TAB_VIEWS: { id: SidebarView; label: string }[] = [
	{ id: "list", label: "待办" },
	{ id: "calendar", label: "日历" },
	{ id: "quadrants", label: "四象限" },
];

export function MobileTopBar() {
	const { activeView, setActiveView } = useUiStore();
	const { locale } = useLocaleStore();
	const {
		diarySearchOpen,
		setDiarySearchOpen,
		diarySearchQuery,
		setDiarySearchQuery,
		diaryViewMode,
		setDiaryViewMode,
		diaryLeftOpen,
		setDiaryLeftOpen,
		diaryRightOpen,
		setDiaryRightOpen,
		agentHistoryOpen,
		setAgentHistoryOpen,
	} = useMobileToolbarStore();

	const searchInputRef = useRef<HTMLInputElement>(null);
	const barRef = useRef<HTMLDivElement>(null);

	// 搜索展开后自动聚焦
	useEffect(() => {
		if (activeView === "diary" && diarySearchOpen) {
			searchInputRef.current?.focus();
		}
	}, [diarySearchOpen, activeView]);

	// 点击外部 / ESC 关闭搜索
	useEffect(() => {
		if (!diarySearchOpen) return;
		const onPointerDown = (e: MouseEvent | TouchEvent) => {
			if (barRef.current && !barRef.current.contains(e.target as Node)) {
				setDiarySearchOpen(false);
			}
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setDiarySearchOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("touchstart", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("touchstart", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [diarySearchOpen, setDiarySearchOpen]);

	const isTabView = TAB_VIEWS.some((tab) => tab.id === activeView);
	const navItem = SIDEBAR_NAV_ITEMS.find((item) => item.id === activeView);
	const activeLabel =
		navItem
			? (navItem.label === "agent" ? "AGENT" : navItem.label)
			: (EXTRA_LABELS[activeView] ?? activeView);

	const searchInput = (
		<div className="relative flex-1 min-w-0">
			<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
			<input
				ref={searchInputRef}
				type="text"
				value={diarySearchQuery}
				onChange={(e) => setDiarySearchQuery(e.target.value)}
				placeholder={locale === "zh" ? "搜索笔记..." : "Search notes..."}
				className="w-full h-9 rounded-lg border border-border/30 bg-background/50 pr-8 pl-8 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/30 focus:outline-none"
			/>
			{diarySearchQuery && (
				<button
					type="button"
					onClick={() => setDiarySearchQuery("")}
					className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground/30 transition-colors hover:text-muted-foreground"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);

	const viewButton = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					title={
						diaryViewMode === "single"
							? locale === "zh"
								? "单列"
								: "Single column"
							: locale === "zh"
								? "双列"
								: "Double column"
					}
					className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border/30 bg-background/50 text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground"
				>
					{diaryViewMode === "single" ? (
						<List className="h-3.5 w-3.5" />
					) : (
						<LayoutGrid className="h-3.5 w-3.5" />
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[120px]">
				<DropdownMenuItem onClick={() => setDiaryViewMode("single")}>
					<List className="h-3.5 w-3.5 mr-2" />
					{locale === "zh" ? "单列" : "Single column"}
					{diaryViewMode === "single" && <Check className="h-3.5 w-3.5 ml-auto" />}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setDiaryViewMode("double")}>
					<LayoutGrid className="h-3.5 w-3.5 mr-2" />
					{locale === "zh" ? "双列" : "Double column"}
					{diaryViewMode === "double" && <Check className="h-3.5 w-3.5 ml-auto" />}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<div
			ref={barRef}
			className="relative z-40 flex h-12 shrink-0 items-center gap-1 border-b border-border/40 bg-background px-3"
		>
			{isTabView ? (
				<div className="flex h-full flex-1 items-stretch gap-6">
					{TAB_VIEWS.map((tab) => {
						const isActive = activeView === tab.id;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveView(tab.id)}
								className={cn(
									"relative flex items-center text-sm transition-colors",
									isActive
										? "font-medium text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{tab.label}
								{isActive && (
									<span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
								)}
							</button>
						);
					})}
				</div>
			) : activeView === "diary" && diarySearchOpen ? (
				searchInput
			) : activeView === "diary" && diaryRightOpen ? (
				<>
					<button
						type="button"
						onClick={() => setDiaryRightOpen(false)}
						title={locale === "zh" ? "返回" : "Back"}
						className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
					</button>
					<span className="flex-1 truncate text-base font-medium text-foreground">
						AI 洞察
					</span>
				</>
			) : (
				<>
					{activeView === "diary" && (
						<button
							type="button"
							onClick={() => setDiaryLeftOpen(!diaryLeftOpen)}
							title={locale === "zh" ? "打开侧边栏" : "Toggle sidebar"}
							className={cn(
								"flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
								diaryLeftOpen
									? "text-primary"
									: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
							)}
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
						</button>
					)}
					{activeView === "quickCommand" && (
						<button
							type="button"
							onClick={() => setAgentHistoryOpen(!agentHistoryOpen)}
							title={locale === "zh" ? "历史记录" : "History"}
							className={cn(
								"flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
								agentHistoryOpen
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
							)}
						>
							<History className="h-4 w-4" />
						</button>
					)}
					<span className="flex-1 truncate text-base font-medium text-foreground">
						{activeLabel}
					</span>
				</>
			)}

			{activeView === "diary" && !diaryRightOpen && (
				<>
					{diarySearchOpen ? (
						<button
							type="button"
							onClick={() => setDiarySearchOpen(false)}
							title={locale === "zh" ? "关闭搜索" : "Close search"}
							className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border/30 bg-background/50 text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground"
						>
							<X className="h-4 w-4" />
						</button>
					) : (
						<button
							type="button"
							onClick={() => setDiarySearchOpen(true)}
							title={locale === "zh" ? "搜索笔记" : "Search notes"}
							className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border/30 bg-background/50 text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground"
						>
							<Search className="h-4 w-4" />
						</button>
					)}
					{viewButton}
					<button
						type="button"
						onClick={() => setDiaryRightOpen(!diaryRightOpen)}
						title={locale === "zh" ? "打开对话面板" : "Toggle chat"}
						className={cn(
							"flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
							diaryRightOpen
								? "text-primary"
								: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
						)}
					>
						<Sparkles className="h-4 w-4" />
					</button>
				</>
			)}
		</div>
	);
}
