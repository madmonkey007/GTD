"use client";

import {
	Award,
	BrainCircuit,
	CalendarDays,
	Check,
	Heart,
	LayoutGrid,
	ChevronRight,
	LogOut,
	Pencil,
	Settings,
	X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth/session";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useOpenSettings } from "@/lib/hooks/useOpenSettings";
import { toast } from "@/lib/toast";
import { useUiStore } from "@/lib/store/ui-store";
import type { SidebarView } from "@/lib/store/ui-store/types";

interface ProfilePanelProps {
	setActiveView?: (view: string) => void;
}

async function saveDisplayName(name: string): Promise<string | null> {
	try {
		const res = await fetch("/api/auth/me", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${localStorage.getItem("lifetrace.auth.token") ?? ""}`,
			},
			body: JSON.stringify({ display_name: name }),
		});
		if (!res.ok) throw new Error(`${res.status}`);
		const data = (await res.json()) as { display_name?: string | null };
		return data.display_name ?? null;
	} catch (err) {
		console.error("[ProfilePanel] 更新昵称失败", err);
		toast("昵称保存失败，请稍后再试", { type: "error" });
		return null;
	}
}

export function ProfilePanel({ setActiveView }: ProfilePanelProps) {
	const t = useTranslations();
	const { openSettings } = useOpenSettings();
	const { setActiveView: storeSetActiveView } = useUiStore();
	const isMobile = useIsMobile();
	const user = useAuthStore((s) => s.user);
	const updateUser = useAuthStore((s) => s.updateUser);

	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const [savingName, setSavingName] = useState(false);
	const nameInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editingName) nameInputRef.current?.focus();
	}, [editingName]);

	const displayName = user?.displayName?.trim() || user?.email?.split("@")[0] || "LifeTrace 用户";

	const startEditName = () => {
		setNameDraft(user?.displayName ?? "");
		setEditingName(true);
	};

	const confirmEditName = async () => {
		if (savingName) return;
		const trimmed = nameDraft.trim();
		if (!trimmed || trimmed === (user?.displayName ?? "")) {
			setEditingName(false);
			return;
		}
		setSavingName(true);
		const saved = await saveDisplayName(trimmed);
		setSavingName(false);
		if (saved !== null) {
			updateUser({ displayName: saved });
			toast("昵称已更新");
		}
		setEditingName(false);
	};

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

	// 日历/四象限/习惯等入口是给移动端底部 tab 放不下时收纳用的，
	// PC 端侧边栏已有全部入口，只保留设置，避免重复
	const menuItems = isMobile
		? MENU_ITEMS
		: MENU_ITEMS.filter((item) => item.id === "settings");

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			{/* Profile Header */}
			<div className="flex flex-col items-center gap-4 px-6 pt-8 pb-6">
				<div className="relative">
					<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-4 ring-background">
						{displayName.slice(0, 1).toUpperCase()}
					</div>
					<span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
				</div>
				<div className="text-center">
					{editingName ? (
						<div className="flex items-center gap-1.5">
							<input
								ref={nameInputRef}
								value={nameDraft}
								onChange={(e) => setNameDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.nativeEvent.isComposing) {
										void confirmEditName();
									}
									if (e.key === "Escape") setEditingName(false);
								}}
								maxLength={120}
								placeholder="输入昵称"
								className="h-8 w-40 rounded-md border border-border/40 bg-background px-2 text-center text-sm text-foreground focus:outline-none focus:border-primary/40"
							/>
							<button
								type="button"
								onClick={() => void confirmEditName()}
								disabled={savingName}
								title="保存"
								className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
							>
								<Check className="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onClick={() => setEditingName(false)}
								title="取消"
								className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={startEditName}
							title="编辑昵称"
							className="group mx-auto flex items-center gap-1.5 text-lg font-semibold text-foreground"
						>
							{displayName}
							<Pencil className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
						</button>
					)}
					{user?.email && (
						<p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
					)}
					{!editingName && !user?.displayName && (
						<p className="mt-1 text-xs text-muted-foreground/50">点击昵称可编辑</p>
					)}
				</div>
			</div>

			{/* Menu Items */}
			<div className="mx-4 flex-1">
				<div className="rounded-xl border border-border/40 bg-card/30 divide-y divide-border/30">
					{menuItems.map((item) => {
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
