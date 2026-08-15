"use client";

// 同步状态 store：离线徽章 / 同步面板 / requireOnline 守卫共用
import { create } from "zustand";
import { toastWarning } from "@/lib/toast";

export interface SyncConflictInfo {
	uid: string;
	entityType: "todo" | "journal" | "habit";
	message: string;
	at: string;
}

interface SyncStatusState {
	online: boolean;
	flushing: boolean;
	pendingCount: number;
	lastSyncAt: string | null;
	conflicts: SyncConflictInfo[];
	setOnline: (online: boolean) => void;
	setFlushing: (flushing: boolean) => void;
	setPendingCount: (count: number) => void;
	setLastSyncAt: (at: string) => void;
	addConflict: (conflict: SyncConflictInfo) => void;
	dismissConflict: (uid: string) => void;
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
	online: typeof navigator === "undefined" ? true : navigator.onLine,
	flushing: false,
	pendingCount: 0,
	lastSyncAt: null,
	conflicts: [],
	setOnline: (online) => set({ online }),
	setFlushing: (flushing) => set({ flushing }),
	setPendingCount: (pendingCount) => set({ pendingCount }),
	setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
	addConflict: (conflict) =>
		set((s) => ({ conflicts: [conflict, ...s.conflicts].slice(0, 20) })),
	dismissConflict: (uid) =>
		set((s) => ({ conflicts: s.conflicts.filter((c) => c.uid !== uid) })),
}));

/**
 * 在线限定操作的守卫：离线时 toast 提示并返回 false。
 * 用于项目/集合/附件/排序等 v1 不支持离线写入的操作。
 */
export function requireOnline(): boolean {
	if (typeof navigator !== "undefined" && !navigator.onLine) {
		toastWarning("离线暂不可用，联网后重试");
		return false;
	}
	return true;
}
