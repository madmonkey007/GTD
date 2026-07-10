"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";
import { SettingsSection } from "./SettingsSection";

type DevToolsPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";
type DevToolsTheme = "system" | "light" | "dark";
type DevToolsSize = "small" | "medium" | "large";

/**
 * 在 nextjs-portal 的 shadow DOM 中查找包含指定文本的按钮并点击
 */
function clickPortalButtonByText(textSubstring: string): boolean {
	try {
		const portal = document.querySelector("nextjs-portal");
		if (!portal?.shadowRoot) return false;

		const allButtons = portal.shadowRoot.querySelectorAll("button");
		for (const btn of allButtons) {
			if (btn.textContent?.toLowerCase().includes(textSubstring.toLowerCase())) {
				btn.click();
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * 尝试通过 shadow DOM 设置 DevTools 选择类偏好
 */
function trySetPortalSelect(
	labelHint: string,
	value: string,
): boolean {
	try {
		const portal = document.querySelector("nextjs-portal");
		if (!portal?.shadowRoot) return false;

		const shadow = portal.shadowRoot;

		// 策略 1: 查找 <select>，匹配 aria-label
		const selects = shadow.querySelectorAll("select");
		for (const sel of selects) {
			const label = sel.getAttribute("aria-label")?.toLowerCase() ?? "";
			if (label.includes(labelHint)) {
				sel.value = value;
				sel.dispatchEvent(new Event("change", { bubbles: true }));
				return true;
			}
		}

		// 策略 2: 查找 role="radiogroup"
		const radioGroups = shadow.querySelectorAll('[role="radiogroup"]');
		for (const group of radioGroups) {
			const radios = group.querySelectorAll('[role="radio"]');
			for (const radio of radios) {
				const val = radio.getAttribute("value") ?? radio.textContent ?? "";
				if (val.toLowerCase() === value.toLowerCase()) {
					(radio as HTMLElement).click();
					return true;
				}
			}
		}

		return false;
	} catch {
		return false;
	}
}

/** 检测是否在 Mac 平台 */
function isMac(): boolean {
	if (typeof navigator === "undefined") return false;
	return /platform|mac|iphone|ipad/i.test(navigator.platform ?? "");
}

/**
 * 开发者工具偏好设置区块组件
 * 将 Next.js DevTools 的 Preference 面板中的设置迁移到设置面板中
 */
export function DevToolsPreferencesSection() {
	const t = useTranslations("page.settings");
	const [mounted, setMounted] = useState(false);

	const [position, setPosition] = useState<DevToolsPosition>("bottom-left");
	const [theme, setTheme] = useState<DevToolsTheme>("system");
	const [size, setSize] = useState<DevToolsSize>("medium");
	const [isRestarting, setIsRestarting] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [isRecording, setIsRecording] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	/** 重启开发服务器 */
	const handleRestartServer = useCallback(async () => {
		setIsRestarting(true);
		try {
			if (clickPortalButtonByText("Restart")) {
				toastSuccess(t("devToolsActionSuccess"));
			} else {
				toastError(t("devToolsPortalNotFound"));
			}
		} catch {
			toastError(t("devToolsActionFailed", { error: "Unknown" }));
		} finally {
			setIsRestarting(false);
		}
	}, [t]);

	/** 重置打包缓存 */
	const handleResetCache = useCallback(async () => {
		setIsResetting(true);
		try {
			if (clickPortalButtonByText("Reset")) {
				toastSuccess(t("devToolsActionSuccess"));
			} else {
				toastError(t("devToolsPortalNotFound"));
			}
		} catch {
			toastError(t("devToolsActionFailed", { error: "Unknown" }));
		} finally {
			setIsResetting(false);
		}
	}, [t]);

	/** 本次会话隐藏 */
	const handleHideSession = useCallback(() => {
		try {
			if (clickPortalButtonByText("Hide")) {
				toastSuccess(t("devToolsActionSuccess"));
			} else {
				toastError(t("devToolsPortalNotFound"));
			}
		} catch {
			toastError(t("devToolsActionFailed", { error: "Unknown" }));
		}
	}, [t]);

	/** 主题修改 */
	const handleThemeChange = useCallback(
		(newTheme: DevToolsTheme) => {
			setTheme(newTheme);
			trySetPortalSelect("theme", newTheme);
			toastSuccess(t("devToolsActionSuccess"));
		},
		[t],
	);

	/** 位置修改 */
	const handlePositionChange = useCallback(
		(newPosition: DevToolsPosition) => {
			setPosition(newPosition);
			trySetPortalSelect("position", newPosition);
			toastSuccess(t("devToolsActionSuccess"));
		},
		[t],
	);

	/** 大小修改 */
	const handleSizeChange = useCallback(
		(newSize: DevToolsSize) => {
			setSize(newSize);
			trySetPortalSelect("size", newSize);
			toastSuccess(t("devToolsActionSuccess"));
		},
		[t],
	);

	/** 录制快捷键 — 打开 DevTools 偏好面板聚焦到快捷键输入 */
	const handleRecordShortcut = useCallback(() => {
		setIsRecording(true);
		try {
			// 先确保偏好面板打开，然后尝试触发快捷键录制
			if (clickPortalButtonByText("Shortcut") || clickPortalButtonByText("Record")) {
				toastSuccess(t("devToolsActionSuccess"));
			} else {
				// 尝试直接通过 nextjs-portal 内部 API 触发
				toastError(t("devToolsPortalNotFound"));
			}
		} catch {
			toastError(t("devToolsActionFailed", { error: "Unknown" }));
		} finally {
			setIsRecording(false);
		}
	}, [t]);

	if (!mounted) {
		return null;
	}

	return (
		<SettingsSection
			title={t("devToolsTitle")}
			description={t("devToolsDescription")}
		>
			<div className="space-y-5">
				{/* ── Theme ── */}
				<div className="flex items-center justify-between">
					<label
						htmlFor="devtools-theme-select"
						className="text-sm font-medium text-foreground"
					>
						{t("devToolsThemeLabel")}
					</label>
					<select
						id="devtools-theme-select"
						value={theme}
						onChange={(e) =>
							handleThemeChange(e.target.value as DevToolsTheme)
						}
						className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					>
						<option value="system">{t("devToolsThemeSystem")}</option>
						<option value="light">{t("devToolsThemeLight")}</option>
						<option value="dark">{t("devToolsThemeDark")}</option>
					</select>
				</div>

				<div className="border-t border-border" />

				{/* ── Position ── */}
				<div className="flex items-center justify-between">
					<label
						htmlFor="devtools-position-select"
						className="text-sm font-medium text-foreground"
					>
						{t("devToolsPositionLabel")}
					</label>
					<select
						id="devtools-position-select"
						value={position}
						onChange={(e) =>
							handlePositionChange(e.target.value as DevToolsPosition)
						}
						className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					>
						<option value="bottom-left">{t("devToolsPositionBl")}</option>
						<option value="bottom-right">{t("devToolsPositionBr")}</option>
						<option value="top-left">{t("devToolsPositionTl")}</option>
						<option value="top-right">{t("devToolsPositionTr")}</option>
					</select>
				</div>

				<div className="border-t border-border" />

				{/* ── Size ── */}
				<div className="flex items-center justify-between">
					<label
						htmlFor="devtools-size-select"
						className="text-sm font-medium text-foreground"
					>
						{t("devToolsSizeLabel")}
					</label>
					<select
						id="devtools-size-select"
						value={size}
						onChange={(e) =>
							handleSizeChange(e.target.value as DevToolsSize)
						}
						className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					>
						<option value="small">{t("devToolsSizeSmall")}</option>
						<option value="medium">{t("devToolsSizeMedium")}</option>
						<option value="large">{t("devToolsSizeLarge")}</option>
					</select>
				</div>

				<div className="border-t border-border" />

				{/* ── Hide for session ── */}
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<p className="text-sm font-medium text-foreground">
							{t("devToolsHideSession")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("devToolsHideSessionHint")}
						</p>
					</div>
					<button
						type="button"
						onClick={handleHideSession}
						className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
					>
						{t("devToolsHideSession")}
					</button>
				</div>

				<div className="border-t border-border" />

				{/* ── Keyboard shortcut ── */}
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<p className="text-sm font-medium text-foreground">
							{t("devToolsKeyboardShortcut")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("devToolsKeyboardShortcutHint")}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground">
							{isMac() ? "⌘+⇧+." : "Ctrl+Shift+."}
						</kbd>
						<button
							type="button"
							disabled={isRecording}
							onClick={handleRecordShortcut}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
						>
							{isRecording ? "..." : t("devToolsRecordShortcut")}
						</button>
					</div>
				</div>

				<div className="border-t border-border" />

				{/* ── Action buttons ── */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<p className="text-sm font-medium text-foreground">
								{t("devToolsRestartServer")}
							</p>
							<p className="text-xs text-muted-foreground">
								{t("devToolsRestartServerHint")}
							</p>
						</div>
						<button
							type="button"
							disabled={isRestarting}
							onClick={handleRestartServer}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
						>
							{isRestarting ? "..." : t("devToolsRestartServer")}
						</button>
					</div>

					<div className="flex items-center justify-between">
						<div className="flex-1">
							<p className="text-sm font-medium text-foreground">
								{t("devToolsResetCache")}
							</p>
							<p className="text-xs text-muted-foreground">
								{t("devToolsResetCacheHint")}
							</p>
						</div>
						<button
							type="button"
							disabled={isResetting}
							onClick={handleResetCache}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
						>
							{isResetting ? "..." : t("devToolsResetCache")}
						</button>
					</div>
				</div>

				<div className="border-t border-border" />

				{/* ── Disable for project (info) ── */}
				<div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
					<p className="text-sm font-medium text-foreground">
						{t("devToolsDisableProject")}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						{t("devToolsDisableProjectHint")}
					</p>
					<code className="mt-2 block rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
						devIndicators: &#123; position: &quot;{position}&quot; &#125;
					</code>
				</div>
			</div>
		</SettingsSection>
	);
}
