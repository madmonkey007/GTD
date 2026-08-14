"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	Award,
	BookOpen,
	BrainCircuit,
	CalendarDays,
	Heart,
	LayoutGrid,
	ListTodo,
	Settings,
	Sparkles,
	Timer,
	X,
} from "lucide-react";
import { useState } from "react";
import { useOpenSettings } from "@/lib/hooks/useOpenSettings";
import { useUiStore } from "@/lib/store/ui-store";
import type { SidebarView } from "@/lib/store/ui-store/types";
import { cn } from "@/lib/utils";

/** 主 tab：固定 4 个，更多抽屉收纳其余视图 */
const PRIMARY_TABS = [
	{ id: "quickCommand" as const, label: "AGENT", icon: Sparkles },
	{ id: "list" as const, label: "清单", icon: ListTodo },
	{ id: "diary" as const, label: "笔记", icon: BookOpen },
	{ id: "more" as const, label: "更多", icon: LayoutGrid },
];

/** 更多抽屉：除 3 个主 tab 外的其余视图 */
const MORE_ITEMS: { id: SidebarView; label: string; icon: typeof ListTodo }[] = [
	{ id: "calendar", label: "日历", icon: CalendarDays },
	{ id: "quadrants", label: "四象限", icon: LayoutGrid },
	{ id: "pomodoro", label: "番茄时钟", icon: Timer },
	{ id: "habits", label: "习惯", icon: Heart },
	{ id: "achievements", label: "成就", icon: Award },
	{ id: "zeroThink", label: "零秒思考", icon: BrainCircuit },
];

export function MobileBottomNav() {
	const { activeView, setActiveView } = useUiStore();
	const { openSettings } = useOpenSettings();
	const [moreOpen, setMoreOpen] = useState(false);

	const handleTab = (id: string) => {
		if (id === "more") {
			setMoreOpen(true);
			return;
		}
		setActiveView(id as SidebarView);
	};

	const handleMoreItem = (id: SidebarView) => {
		setActiveView(id);
		setMoreOpen(false);
	};

	const inMore = (view: SidebarView) =>
		MORE_ITEMS.some((item) => item.id === view);

	return (
		<>
			<nav className="relative z-40 flex h-14 shrink-0 items-stretch justify-around border-t border-border/40 bg-background px-1 pb-[env(safe-area-inset-bottom)]">
				{PRIMARY_TABS.map((tab) => {
					const Icon = tab.icon;
					const isActive =
						activeView === tab.id || (tab.id === "more" && inMore(activeView));
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

			<AnimatePresence>
				{moreOpen && (
					<>
						<motion.div
							className="fixed inset-0 z-50 bg-black/30"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							onClick={() => setMoreOpen(false)}
						/>
						<motion.div
							className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-stretch rounded-t-2xl border-t border-border/40 bg-background p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-xl"
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 300 }}
						>
							<div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border" />
							<div className="flex items-center justify-between px-1 pb-1">
								<span className="text-xs font-medium text-muted-foreground">
									更多
								</span>
								<button
									type="button"
									onClick={() => setMoreOpen(false)}
									className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50"
									aria-label="关闭更多菜单"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							<div className="flex flex-col gap-0.5">
								{MORE_ITEMS.map((item) => {
									const Icon = item.icon;
									const isActive = activeView === item.id;
									return (
										<button
											key={item.id}
											type="button"
											onClick={() => handleMoreItem(item.id)}
											className={cn(
												"flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm transition-colors",
												"hover:bg-muted/40",
												isActive
													? "bg-primary/10 text-primary font-medium"
													: "text-muted-foreground",
											)}
										>
											<Icon className="h-4 w-4 shrink-0" />
											<span>{item.label}</span>
										</button>
									);
								})}
								<button
									type="button"
									onClick={() => {
										setMoreOpen(false);
										openSettings();
									}}
									className="flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
								>
									<Settings className="h-4 w-4 shrink-0" />
									<span>设置</span>
								</button>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	);
}
