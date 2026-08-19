"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {

	prompt: () => Promise<void>;

	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegister() {
	const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
	const [isIos, setIsIos] = useState(false);
	const [showIosHelp, setShowIosHelp] = useState(false);
	const [installed, setInstalled] = useState(false);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			!("serviceWorker" in navigator)
		) {
			return;
		}

		// 延迟注册，不阻塞页面首屏渲染
		const timer = setTimeout(async () => {
			try {
				const reg = await navigator.serviceWorker.register("/sw.js", {
					scope: "/",
				});
				console.log("[PWA] ServiceWorker registered:", reg.scope);
				// 启动时通知 SW 冲刷离线条目：SW 广播 LIFETRACE_SYNC 给页面，页面引擎负责 push/pull
				const controller = reg.active ?? reg.waiting;
				controller?.postMessage({ type: "LIFETRACE_SYNC_REQUEST" });
			} catch (err) {
				console.warn("[PWA] ServiceWorker registration failed:", err);
			}
		}, 1000);

		const standalone = window.matchMedia("(display-mode: standalone)").matches ||
			(window.navigator as Navigator & { standalone?: boolean }).standalone === true;
		setInstalled(standalone);
		setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !standalone);
		const onInstallPrompt = (event: Event) => {
			event.preventDefault();
			setInstallPrompt(event as InstallPromptEvent);
		};
		const onInstalled = () => {
			setInstalled(true);
			setInstallPrompt(null);
			setShowIosHelp(false);
		};
		window.addEventListener("beforeinstallprompt", onInstallPrompt);
		window.addEventListener("appinstalled", onInstalled);

		return () => {
			clearTimeout(timer);
			window.removeEventListener("beforeinstallprompt", onInstallPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	if (installed || (!installPrompt && !isIos)) return null;

	const install = async () => {
		if (isIos) {
			setShowIosHelp((visible) => !visible);
			return;
		}
		if (!installPrompt) return;
		await installPrompt.prompt();
		const choice = await installPrompt.userChoice;
		if (choice.outcome === "accepted") setInstalled(true);
		setInstallPrompt(null);
	};

	return (
		<div className="fixed inset-x-0 top-0 z-[9999] flex justify-center px-3 pt-3">
			{showIosHelp && (
				<div className="mr-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
					点击浏览器的“分享”按钮，然后选择“添加到主屏幕”。
				</div>
			)}
			<button
				type="button"
				onClick={install}
				className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-slate-700"
			>
				安装 LifeTrace
			</button>
		</div>
	);
}
