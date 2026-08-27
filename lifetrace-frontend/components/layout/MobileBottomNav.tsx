"use client";

import {
	BookOpen,
	Heart,
	Inbox,
	ListTodo,
	User,
} from "lucide-react";
import { useUiStore } from "@/lib/store/ui-store";
import type { SidebarView } from "@/lib/store/ui-store/types";
import { cn } from "@/lib/utils";

/** 主 tab：固定 5 个，我的收纳其余视图 */
const PRIMARY_TABS = [
	{ id: "quickCommand" as const, label: "收集箱", icon: Inbox },
	{ id: "list" as const, label: "待办", icon: ListTodo },
	{ id: "diary" as const, label: "笔记", icon: BookOpen },
	{ id: "habits" as const, label: "习惯", icon: Heart },
	{ id: "profile" as const, label: "我的", icon: User },
];

export function MobileBottomNav() {
	const { activeView, setActiveView } = useUiStore();

	const handleTab = (id: string) => {
		setActiveView(id as SidebarView);
	};

	return (
		<nav className="relative z-40 flex h-14 shrink-0 items-stretch justify-around border-t border-border/40 bg-background px-1 pb-[env(safe-area-inset-bottom)]">
			{PRIMARY_TABS.map((tab) => {
				const Icon = tab.icon;
				const isActive = activeView === tab.id;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => handleTab(tab.id)}
						className={cn(
							"flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors",
							isActive
								? "text-primary"
								: "text-muted-foreground hover:text-foreground",
						)}
						aria-label={tab.label}
					>
						<Icon
							className={cn(
								"h-5 w-5 transition-transform",
								isActive && "scale-110",
							)}
							strokeWidth={isActive ? 2.4 : 2}
						/>
						<span
							className={cn(
								"text-[10px] leading-none",
								isActive ? "font-medium" : "font-normal",
							)}
						>
							{tab.label}
						</span>
					</button>
				);
			})}
		</nav>
	);
}
