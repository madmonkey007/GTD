"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Filter, LayoutGrid, X } from "lucide-react";
import { useState } from "react";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { FilterColumn } from "./FilterColumn";
import { SIDEBAR_NAV_ITEMS } from "./SidebarNav";

export function MobileTopBar() {
	const { activeView, setActiveView } = useUiStore();
	const [filterOpen, setFilterOpen] = useState(false);
	const [navOpen, setNavOpen] = useState(false);

	const activeLabel =
		SIDEBAR_NAV_ITEMS.find((item) => item.id === activeView)?.label ??
		activeView;

	return (
		<>
			<div className="relative z-40 flex h-12 shrink-0 items-center justify-between border-b border-border/40 bg-background px-3">
				<button
					type="button"
					onClick={() => setFilterOpen(true)}
					className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50"
					aria-label="筛选"
				>
					<Filter className="h-4.5 w-4.5" />
				</button>

				<span className="text-sm font-medium text-foreground">
					{activeLabel}
				</span>

				<button
					type="button"
					onClick={() => setNavOpen(true)}
					className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50"
					aria-label="切换视图"
				>
					<LayoutGrid className="h-4.5 w-4.5" />
				</button>
			</div>

			<AnimatePresence>
				{filterOpen && (
					<>
						<motion.div
							className="fixed inset-0 z-50 bg-black/30"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							onClick={() => setFilterOpen(false)}
						/>
						<motion.div
							className="fixed inset-y-0 left-0 z-50"
							initial={{ x: "-100%" }}
							animate={{ x: 0 }}
							exit={{ x: "-100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 300 }}
						>
							<div className="relative h-full rounded-r-lg border-r border-border/40 bg-background shadow-xl">
								<button
									type="button"
									onClick={() => setFilterOpen(false)}
									className="absolute right-2 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50"
									aria-label="关闭筛选"
								>
									<X className="h-4 w-4" />
								</button>
								<FilterColumn widthOverride="min(80vw,280px)" />
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{navOpen && (
					<>
						<motion.div
							className="fixed inset-0 z-50 bg-black/30"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							onClick={() => setNavOpen(false)}
						/>
						<motion.div
							className="fixed inset-y-0 right-0 z-50 flex flex-col"
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 300 }}
						>
							<div className="flex h-full w-[min(80vw,280px)] flex-col rounded-l-lg border-l border-border/40 bg-background p-3 shadow-xl">
								<div className="flex items-center justify-between px-1 pb-2">
									<span className="text-xs font-medium text-muted-foreground">
										切换视图
									</span>
									<button
										type="button"
										onClick={() => setNavOpen(false)}
										className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50"
										aria-label="关闭视图菜单"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
								<div className="flex flex-col gap-0.5">
									{SIDEBAR_NAV_ITEMS.map((item) => {
										const Icon = item.icon;
										const isActive = activeView === item.id;
										return (
											<button
												key={item.id}
												type="button"
												onClick={() => {
													setActiveView(item.id);
													setNavOpen(false);
												}}
												className={cn(
													"flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
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
								</div>
								<div className="flex-1" />
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	);
}
