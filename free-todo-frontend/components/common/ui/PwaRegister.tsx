"use client";

import { useEffect } from "react";

export function PwaRegister() {
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
			} catch (err) {
				console.warn("[PWA] ServiceWorker registration failed:", err);
			}
		}, 1000);

		return () => clearTimeout(timer);
	}, []);

	return null;
}
