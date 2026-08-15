"use client";

import { useEffect } from "react";
import { syncNow } from "@/lib/offline/engine";
import { hydrateOfflineCache } from "@/lib/offline/hydrate";
import { refreshPendingCount } from "@/lib/offline/outbox";
import { useSyncStatus } from "@/lib/offline/status";

export function SyncController() {
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const schedule = () => {
			clearTimeout(timer);
			timer = setTimeout(() => void syncNow().catch(console.warn), 300);
		};
		const online = () => { useSyncStatus.getState().setOnline(true); schedule(); };
		const offline = () => useSyncStatus.getState().setOnline(false);
		const visible = () => { if (document.visibilityState === "visible") schedule(); };
		const serviceWorkerMessage = (event: MessageEvent) => {
			if (event.data?.type === "LIFETRACE_SYNC") schedule();
		};
		void hydrateOfflineCache()
			.then(refreshPendingCount)
			.then(schedule)
			.catch(console.warn);
		window.addEventListener("online", online);
		window.addEventListener("offline", offline);
		document.addEventListener("visibilitychange", visible);
		navigator.serviceWorker?.addEventListener("message", serviceWorkerMessage);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("online", online);
			window.removeEventListener("offline", offline);
			document.removeEventListener("visibilitychange", visible);
			navigator.serviceWorker?.removeEventListener("message", serviceWorkerMessage);
		};
	}, []);
	return null;
}
