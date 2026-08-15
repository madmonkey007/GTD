"use client";

import {
	Award,
	BrainCircuit,
	CalendarDays,
	Heart,
	LayoutGrid,
	ChevronRight,
	LogOut,
	Settings,
	User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useOpenSettings } from "@/lib/hooks/useOpenSettings";
import { useUiStore } from "@/lib/store/ui-store";
import type { SidebarView } from "@/lib/store/ui-store/types";

interface ProfilePanelProps {
	setActiveView?: (view: string) => void;
}

export function ProfilePanel({ setActiveView }: ProfilePanelProps) {
	const t = useTranslations();
	const { openSettings } = useOpenSettings();
	const { setActiveView: storeSetActiveView } = useUiStore();

	const navigate = (view: SidebarView) => {
		if (setActiveView) {
			setActiveView(view);
		} else {
			storeSetActiveView(view);
		}
	};

	const MENU_ITEMS = [
		{
			id: "calendar" as const,
			label: t("bottomDock.calendar"),
			icon: CalendarDays,
			color: "text-sky-500",
			bg: "bg-sky-500/10",
			onClick: () => navigate("calendar"),
		},
		{
			id: "quadrants" as const,
			label: t("bottomDock.quadrants"),
			icon: LayoutGrid,
			color: "text-cyan-500",
			bg: "bg-cyan-500/10",
			onClick: () => navigate("quadrants"),
		},
		{
			id: "habits" as const,
			label: t("bottomDock.habits"),
			icon: Heart,
			color: "text-rose-500",
			bg: "bg-rose-500/10",
			onClick: () => navigate("habits"),
		},
		{
			id: "achievements" as const,
			label: t("bottomDock.achievements"),
			icon: Award,
			color: "text-amber-500",
			bg: "bg-amber-500/10",
			onClick: () => navigate("achievements"),
		},
		{
			id: "zeroThink" as const,
			label: t("bottomDock.zeroThink"),
			icon: BrainCircuit,
			color: "text-violet-500",
			bg: "bg-violet-500/10",
			onClick: () => navigate("zeroThink"),
		},
		{
			id: "settings",
			label: t("bottomDock.settings"),
			icon: Settings,
			color: "text-muted-foreground",
			bg: "bg-muted/40",
			onClick: openSettings,
		},
	];

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			{/* Profile Header */}
			<div className="flex flex-col items-center gap-4 px-6 pt-8 pb-6">
				<div className="relative">
					<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-background">
						<User className="h-10 w-10" strokeWidth={1.5} />
					</div>
					<span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
				</div>
				<div className="text-center">
					<h2 className="text-lg font-semibold text-foreground">
						LifeTrace 用户
					</h2>
					<p className="mt-0.5 text-sm text-muted-foreground">
						AI 驱动的智能生活追踪
					</p>
				</div>
			</div>

			{/* Menu Items */}
			<div className="mx-4 flex-1">
				<div className="rounded-xl border border-border/40 bg-card/30 divide-y divide-border/30">
					{MENU_ITEMS.map((item) => {
						const Icon = item.icon;
						return (
							<button
								key={item.id}
								type="button"
								onClick={item.onClick}
								className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 first:rounded-t-xl last:rounded-b-xl"
							>
								<span
									className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}
								>
									<Icon className="h-4.5 w-4.5" />
								</span>
								<span className="flex-1 text-sm font-medium text-foreground/90">
									{item.label}
								</span>
								<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
							</button>
						);
					})}
				</div>
			</div>

			{/* Footer */}
			<div className="px-6 py-4">
				<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/40">
					<LogOut className="h-3 w-3" />
					<span>LifeTrace v1.0</span>
				</div>
			</div>
		</div>
	);
}
