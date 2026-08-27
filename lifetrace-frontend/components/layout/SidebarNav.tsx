"use client";

import {
	BookOpen,
	Heart,
	Inbox,
	ListTodo,
	Settings,
	User,
} from "lucide-react";
import Image from "next/image";
import { useOpenSettings } from "@/lib/hooks/useOpenSettings";
import { useUiStore } from "@/lib/store/ui-store";
import type { SidebarView } from "@/lib/store/ui-store/types";
import { cn } from "@/lib/utils";

export const SIDEBAR_NAV_ITEMS: {
	id: SidebarView;
	label: string;
	icon: typeof ListTodo;
}[] = [
	{ id: "quickCommand", label: "收集箱", icon: Inbox },
	{ id: "list", label: "清单", icon: ListTodo },
	{ id: "diary", label: "笔记", icon: BookOpen },
	{ id: "habits", label: "习惯", icon: Heart },
];

export function SidebarNav() {
	const { activeView, setActiveView } = useUiStore();
	const { openSettings } = useOpenSettings();

	return (
		<nav className="flex flex-col items-center h-full py-2">
			<button
				onClick={() => setActiveView("list")}
				className="relative h-6 w-6 shrink-0 mb-2.5"
				title="GTD"
				type="button"
			>
				<Image
					src="/free-todo-logos/free_todo_icon_4_dark_with_grid.png"
					alt="GTD"
					fill
					className="object-contain block dark:hidden"
					priority
				/>
				<Image
					src="/free-todo-logos/free_todo_icon_4_with_grid.png"
					alt="GTD"
					fill
					className="object-contain hidden dark:block"
					priority
				/>
			</button>

			<div className="flex flex-col items-center gap-0.5">
				{SIDEBAR_NAV_ITEMS.map((item) => {
					const Icon = item.icon;
					const isActive = activeView === item.id;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => setActiveView(item.id)}
							title={item.label}
							className={cn(
								"group relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
								"hover:bg-muted/50",
								isActive
									? "bg-primary/10 text-primary"
									: "text-muted-foreground",
							)}
						>
							{isActive && (
								<div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
							)}
							<Icon className="h-4.5 w-4.5" />
						</button>
					);
				})}
			</div>

			<div className="flex-1" />

			<button
				onClick={() => setActiveView("profile")}
				type="button"
				className={cn(
					"relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
					"hover:bg-muted/50",
					activeView === "profile"
						? "bg-primary/10 text-primary"
						: "text-muted-foreground",
				)}
				title="我的"
			>
				{activeView === "profile" && (
					<div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
				)}
				<User className="h-4.5 w-4.5" />
			</button>

			<button
				onClick={openSettings}
				type="button"
				className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
				title="设置"
			>
				<Settings className="h-4.5 w-4.5" />
			</button>
		</nav>
	);
}
