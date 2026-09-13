"use client";

// 离线/同步状态徽章：固定右下角小圆点。
// 离线 → 灰色"离线"；有待同步 → 橙色数字；冲突 → 红色叹号。点击展开同步面板。
import { useState, useSyncExternalStore } from "react";
import { syncNow } from "@/lib/offline/engine";
import { refreshPendingCount } from "@/lib/offline/outbox";
import { useSyncStatus } from "@/lib/offline/status";

export function OfflineBadge() {
	const mounted = useSyncExternalStore(
		() => () => {},
		() => true,
		() => false,
	);
	const { online, pendingCount, flushing, lastSyncAt, conflicts, errors, requestError } =
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
		<div className="fixed bottom-16 left-3 z-[9999] flex flex-col items-start gap-2">
			{open && (
				<div className="w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border bg-background p-3 text-xs shadow-lg">
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
					{(requestError || errors.length > 0) && (
						<div role="status" className="mb-3 max-h-60 space-y-2 overflow-y-auto break-words rounded border border-amber-500/30 bg-amber-500/5 p-2">
							<p className="font-medium">同步失败原因（本地修改仍保留）</p>
							{requestError && <p>{requestError}</p>}
							{errors.map((error) => (
								<div key={error.opId} className="border-t border-amber-500/20 pt-2">
									<p className="font-medium">{error.label} · 已重试 {error.attempts} 次</p>
									<p className="mt-1 select-text whitespace-pre-wrap">{error.message}</p>
								</div>
							))}
						</div>
					)}
					{conflicts.length > 0 && (
						<div className="mb-2 max-h-32 overflow-auto text-red-500">
							{conflicts.map((c) => (
								<div key={c.uid + c.at}>{c.message}</div>
							))}
						</div>
					)}
					<button
						type="button"
						disabled={flushing}
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
				onClick={() => {
					if (!open) void refreshPendingCount().catch(console.warn);
					setOpen((v) => !v);
				}}
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
