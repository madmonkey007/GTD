"use client";

// 离线/同步状态徽章：固定右下角小圆点。
// 离线 → 灰色"离线"；有待同步 → 橙色数字；冲突 → 红色叹号。点击展开同步面板。
import { useState, useSyncExternalStore } from "react";
import { syncNow } from "@/lib/offline/engine";
import { useSyncStatus } from "@/lib/offline/status";

export function OfflineBadge() {
	const mounted = useSyncExternalStore(
		() => () => {},
		() => true,
		() => false,
	);
	const { online, pendingCount, flushing, lastSyncAt, conflicts } =
		useSyncStatus();
	const [open, setOpen] = useState(false);

	if (!mounted) return null;

	if (online && pendingCount === 0 && conflicts.length === 0 && !open) {
		return null;
	}

	const color = !online
		? "bg-neutral-500"
		: conflicts.length > 0
			? "bg-red-500"
			: "bg-amber-500";

	return (
		<div className="fixed bottom-16 right-3 z-[9999] flex flex-col items-end gap-2">
			{open && (
				<div className="rounded-lg border bg-background p-3 text-xs shadow-lg min-w-44">
					<div className="mb-2 font-medium">
						{online ? "在线" : "离线"}
						{lastSyncAt && (
							<span className="ml-1 text-neutral-400">
								上次同步 {new Date(lastSyncAt).toLocaleTimeString()}
							</span>
						)}
					</div>
					<div className="mb-2 text-neutral-500">
						待同步操作：{pendingCount} 项
					</div>
					{conflicts.length > 0 && (
						<div className="mb-2 max-h-32 overflow-auto text-red-500">
							{conflicts.map((c) => (
								<div key={c.uid + c.at}>{c.message}</div>
							))}
						</div>
					)}
					<button
						type="button"
						className="w-full rounded border px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
						onClick={() => {
							syncNow().catch(() => {});
						}}
					>
						{flushing ? "同步中…" : "立即同步"}
					</button>
				</div>
			)}
			<button
				type="button"
				aria-label="同步状态"
				className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-white shadow-md ${color}`}
				onClick={() => setOpen((v) => !v)}
			>
				{!online
					? "离线"
					: conflicts.length > 0
						? "!"
						: flushing
							? "同步中"
							: `${pendingCount} 待同步`}
			</button>
		</div>
	);
}
