"use client";

import { useUiStore } from "@/lib/store/ui-store";
import { SIDEBAR_NAV_ITEMS } from "./SidebarNav";

export function MobileTopBar() {
	const { activeView } = useUiStore();

	const navItem = SIDEBAR_NAV_ITEMS.find((item) => item.id === activeView);
	const activeLabel = navItem ? (navItem.label === "agent" ? "AGENT" : navItem.label) : activeView;

	return (
		<div className="relative z-40 flex h-12 shrink-0 items-center border-b border-border/40 bg-background px-3">
			<span className="text-sm font-medium text-foreground">
				{activeLabel}
			</span>
		</div>
	);
}
