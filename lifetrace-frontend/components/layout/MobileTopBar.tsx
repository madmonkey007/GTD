"use client";

import { useUiStore } from "@/lib/store/ui-store";
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

	const isTabView = TAB_VIEWS.some((tab) => tab.id === activeView);
	const navItem = SIDEBAR_NAV_ITEMS.find((item) => item.id === activeView);
	const activeLabel =
		navItem
			? (navItem.label === "agent" ? "AGENT" : navItem.label)
			: (EXTRA_LABELS[activeView] ?? activeView);

	return (
		<div className="relative z-40 flex h-12 shrink-0 items-center border-b border-border/40 bg-background px-3">
			{isTabView ? (
				<div className="flex h-full items-stretch gap-6">
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
			) : (
				<span className="text-base font-medium text-foreground">
					{activeLabel}
				</span>
			)}
		</div>
	);
}
