"use client";

import { useQuery } from "@tanstack/react-query";
import {
	Award,
	BrainCircuit,
	Camera,
	Check,
	ChevronRight,
	FlaskConical,
	KeyRound,
	LogOut,
	Pencil,
	Settings,
	Timer,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { PasswordInput } from "@/components/common/ui/PasswordInput";
import { customFetcher } from "@/lib/api/fetcher";
import {
	AVATAR_MAX_BYTES,
	changePassword,
	deleteAvatar,
	fetchAvatarUrl,
	updateDisplayName,
	uploadAvatar,
} from "@/lib/auth/api";
import { useAuthStore } from "@/lib/auth/session";
import { useOpenSettings } from "@/lib/hooks/useOpenSettings";
import { useUiStore } from "@/lib/store/ui-store";
import type { SidebarView } from "@/lib/store/ui-store/types";
import { toast } from "@/lib/toast";

interface ProfilePanelProps {
	setActiveView?: (view: string) => void;
}

interface ProfileStats {
	journals: number;
	todos: number;
	projects: number;
	habits: number;
}

/** 拉取当前用户的总量统计（笔记/待办/项目/习惯） */
async function fetchProfileStats(): Promise<ProfileStats> {
	const [journals, todos, projects, habits] = await Promise.all([
		customFetcher<Record<string, unknown>>("/api/journals?limit=1"),
		customFetcher<Record<string, unknown>>("/api/todos?limit=1"),
		customFetcher<Record<string, unknown>>("/api/projects"),
		customFetcher<Record<string, unknown>>("/api/habits?limit=1"),
	]);
	const unwrap = (v: unknown): Record<string, unknown> =>
		v && typeof v === "object" && "data" in (v as Record<string, unknown>)
			? ((v as Record<string, unknown>).data as Record<string, unknown>)
			: (v as Record<string, unknown>);
	const j = unwrap(journals);
	const t = unwrap(todos);
	const h = unwrap(habits);
	const p = projects;
	return {
		journals: Number(j?.total ?? (j?.journals as unknown[] | undefined)?.length ?? 0),
		todos: Number(t?.total ?? (t?.todos as unknown[] | undefined)?.length ?? 0),
		projects: Array.isArray(p) ? p.length : 0,
		habits: Number(h?.total ?? (h?.habits as unknown[] | undefined)?.length ?? 0),
	};
}

const STAT_ITEMS: { key: keyof ProfileStats; label: string }[] = [
	{ key: "journals", label: "笔记" },
	{ key: "todos", label: "待办" },
	{ key: "projects", label: "项目" },
	{ key: "habits", label: "习惯" },
];

function PasswordChangeDialog({ onClose }: { onClose: () => void }) {
	const [oldPassword, setOldPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [saving, setSaving] = useState(false);
	const oldInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		oldInputRef.current?.focus();
	}, []);

	const submit = async () => {
		if (saving) return;
		if (newPassword.length < 8) {
			toast("新密码至少 8 位", { type: "warning" });
			return;
		}
		if (newPassword !== confirmPassword) {
			toast("两次输入的新密码不一致", { type: "warning" });
			return;
		}
		setSaving(true);
		try {
			await changePassword(oldPassword, newPassword);
			toast("密码已修改");
			onClose();
		} catch (err) {
			const status = (err as { status?: number }).status;
			toast(status === 400 ? "原密码不正确" : "修改失败，请稍后再试", {
				type: "error",
			});
		} finally {
			setSaving(false);
		}
	};

	const inputClass =
		"h-9 w-full rounded-md border border-border/40 bg-background px-3 text-sm text-foreground focus:outline-none focus:border-primary/40";

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="修改密码"
			tabIndex={-1}
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") onClose();
			}}
		>
			<div className="w-full max-w-sm rounded-xl border border-border/50 bg-popover p-5 shadow-xl">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-sm font-semibold text-foreground">修改密码</h3>
					<button
						type="button"
						onClick={onClose}
						className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
				<div className="space-y-3">
					<PasswordInput
						inputRef={oldInputRef}
						value={oldPassword}
						onChange={(e) => setOldPassword(e.target.value)}
						placeholder="原密码"
						autoComplete="current-password"
						className={inputClass}
					/>
					<PasswordInput
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						placeholder="新密码（至少 8 位）"
						autoComplete="new-password"
						className={inputClass}
					/>
					<PasswordInput
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.nativeEvent.isComposing) void submit();
						}}
						placeholder="确认新密码"
						autoComplete="new-password"
						className={inputClass}
					/>
				</div>
				<div className="mt-4 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
					>
						取消
					</button>
					<button
						type="button"
						onClick={() => void submit()}
						disabled={saving || !oldPassword || !newPassword || !confirmPassword}
						className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{saving ? "保存中…" : "确认修改"}
					</button>
				</div>
			</div>
		</div>
	);
}

export function ProfilePanel({ setActiveView }: ProfilePanelProps) {
	const t = useTranslations();
	const router = useRouter();
	const { openSettings } = useOpenSettings();
	const { setActiveView: storeSetActiveView } = useUiStore();
	const user = useAuthStore((s) => s.user);
	const updateUser = useAuthStore((s) => s.updateUser);
	const clearSession = useAuthStore((s) => s.clearSession);

	const [editingName, setEditingName] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const [savingName, setSavingName] = useState(false);
	const nameInputRef = useRef<HTMLInputElement>(null);
	const [passwordOpen, setPasswordOpen] = useState(false);
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
	const [avatarBusy, setAvatarBusy] = useState(false);
	const avatarInputRef = useRef<HTMLInputElement>(null);

	const { data: stats } = useQuery({
		queryKey: ["profile-stats"],
		queryFn: fetchProfileStats,
		staleTime: 60 * 1000,
	});

	useEffect(() => {
		if (editingName) nameInputRef.current?.focus();
	}, [editingName]);

	const userId = user?.id;
	const hasAvatar = user?.hasAvatar === true;

	// 有头像时拉取并转成 blob URL；状态变化时回收旧 URL
	useEffect(() => {
		let cancelled = false;
		let currentUrl: string | null = null;
		if (userId && hasAvatar) {
			void fetchAvatarUrl(userId).then((url) => {
				if (cancelled) {
					if (url) URL.revokeObjectURL(url);
					return;
				}
				if (url) {
					currentUrl = url;
					setAvatarUrl(url);
				}
			});
		} else {
			setAvatarUrl(null);
		}
		return () => {
			cancelled = true;
			if (currentUrl) URL.revokeObjectURL(currentUrl);
		};
	}, [userId, hasAvatar]);

	const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file || avatarBusy) return;
		if (!file.type.startsWith("image/")) {
			toast("请选择图片文件", { type: "warning" });
			return;
		}
		if (file.size > AVATAR_MAX_BYTES) {
			toast("图片不能超过 2MB", { type: "warning" });
			return;
		}
		setAvatarBusy(true);
		try {
			await uploadAvatar(file);
			updateUser({ hasAvatar: true });
			toast("头像已更新");
		} catch (err) {
			const status = (err as { status?: number }).status;
			toast(
				status === 413
					? "图片不能超过 2MB"
					: status === 400
						? "仅支持 PNG/JPEG/WebP/GIF 图片"
						: "头像上传失败，请稍后再试",
				{ type: "error" },
			);
		} finally {
			setAvatarBusy(false);
		}
	};

	const handleRemoveAvatar = async () => {
		if (avatarBusy) return;
		setAvatarBusy(true);
		try {
			await deleteAvatar();
			updateUser({ hasAvatar: false });
			toast("已移除头像");
		} catch {
			toast("移除失败，请稍后再试", { type: "error" });
		} finally {
			setAvatarBusy(false);
		}
	};

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
		try {
			const saved = await updateDisplayName(trimmed);
			updateUser({ displayName: saved.displayName ?? null });
			toast("昵称已更新");
		} catch {
			toast("昵称保存失败，请稍后再试", { type: "error" });
		} finally {
			setSavingName(false);
			setEditingName(false);
		}
	};

	const handleLogout = () => {
		clearSession();
		router.push("/login");
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
			id: "achievements" as const,
			label: t("bottomDock.achievements"),
			icon: Award,
			color: "text-amber-500",
			bg: "bg-amber-500/10",
			onClick: () => navigate("achievements"),
		},
		{
			id: "password",
			label: "修改密码",
			icon: KeyRound,
			color: "text-indigo-500",
			bg: "bg-indigo-500/10",
			onClick: () => setPasswordOpen(true),
		},
		{
			id: "logout",
			label: "退出登录",
			icon: LogOut,
			color: "text-destructive",
			bg: "bg-destructive/10",
			onClick: handleLogout,
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

	// 实验室：收纳实验性功能入口，PC/移动端一致展示
	const LAB_ITEMS = [
		{
			id: "pomodoro" as const,
			label: t("bottomDock.pomodoro"),
			icon: Timer,
			color: "text-orange-500",
			bg: "bg-orange-500/10",
			onClick: () => navigate("pomodoro"),
		},
		{
			id: "zeroThink" as const,
			label: t("bottomDock.zeroThink"),
			icon: BrainCircuit,
			color: "text-violet-500",
			bg: "bg-violet-500/10",
			onClick: () => navigate("zeroThink"),
		},
	];

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			{/* Profile Header */}
			<div className="flex flex-col items-center gap-4 px-6 pt-8 pb-2">
				<div className="relative">
					<button
						type="button"
						onClick={() => avatarInputRef.current?.click()}
						disabled={avatarBusy}
						title="上传头像"
						className="group relative block rounded-full focus:outline-none disabled:cursor-wait"
					>
						{avatarUrl ? (
							<img
								src={avatarUrl}
								alt="头像"
								className="h-20 w-20 rounded-full object-cover ring-4 ring-background"
							/>
						) : (
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-4 ring-background">
								{displayName.slice(0, 1).toUpperCase()}
							</div>
						)}
						<span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
							<Camera className="h-6 w-6 text-white" />
						</span>
					</button>
					{avatarBusy && (
						<span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs text-white">
							上传中…
						</span>
					)}
					{hasAvatar && (
						<button
							type="button"
							onClick={() => void handleRemoveAvatar()}
							disabled={avatarBusy}
							title="移除头像"
							aria-label="移除头像"
							className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-muted-foreground shadow-sm hover:text-destructive disabled:opacity-50"
						>
							<X className="h-3 w-3" />
						</button>
					)}
					<span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-background bg-emerald-500" />
					<input
						ref={avatarInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={(e) => void handleAvatarFile(e)}
					/>
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

				{/* 数据统计 */}
				{stats && (
					<div className="grid w-full max-w-xs grid-cols-4 gap-2 pt-2">
						{STAT_ITEMS.map(({ key, label }) => (
							<div
								key={key}
								className="flex flex-col items-center rounded-lg border border-border/30 bg-card/30 py-2"
							>
								<span className="text-base font-semibold tabular-nums text-foreground">
									{stats[key]}
								</span>
								<span className="text-[10px] text-muted-foreground">{label}</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Menu Items */}
			<div className="mx-4 flex-1 py-4">
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

				{/* 实验室 */}
				<div className="mt-4">
					<div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
						<FlaskConical className="h-3.5 w-3.5" />
						实验室
					</div>
					<div className="rounded-xl border border-dashed border-border/50 bg-card/20 divide-y divide-border/30">
						{LAB_ITEMS.map((item) => {
							const Icon = item.icon;
							return (
								<button
									key={item.id}
									type="button"
									onClick={item.onClick}
									className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted/30 first:rounded-t-xl last:rounded-b-xl"
								>
									<span
										className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}
									>
										<Icon className="h-4 w-4" />
									</span>
									<span className="flex-1 text-sm text-foreground/80">
										{item.label}
									</span>
									<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="px-6 py-4">
				<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/40">
					<span>LifeTrace v1.0</span>
				</div>
			</div>

			{passwordOpen && (
				<PasswordChangeDialog onClose={() => setPasswordOpen(false)} />
			)}
		</div>
	);
}
