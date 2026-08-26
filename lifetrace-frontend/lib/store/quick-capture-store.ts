"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuickCaptureType = "note" | "todo" | "inbox";

/** 预定义快捷键组合（避开浏览器保留组合：Ctrl+数字切标签页等） */
export const QUICK_CAPTURE_SHORTCUT_OPTIONS = [
	"Alt+1",
	"Alt+2",
	"Alt+3",
	"Alt+4",
	"Alt+5",
	"Alt+N",
	"Alt+T",
	"Alt+I",
	"Ctrl+Shift+1",
	"Ctrl+Shift+2",
	"Ctrl+Shift+3",
	"Ctrl+Shift+N",
	"Ctrl+Shift+T",
	"Ctrl+Shift+I",
] as const;

export type QuickCaptureShortcut = (typeof QUICK_CAPTURE_SHORTCUT_OPTIONS)[number];

export const DEFAULT_SHORTCUTS: Record<QuickCaptureType, QuickCaptureShortcut> = {
	note: "Alt+1",
	todo: "Alt+2",
	inbox: "Alt+3",
};

/** 将 "Alt+1" 解析为 keydown 事件匹配参数 */
export function matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
	const parts = shortcut.split("+");
	const key = parts[parts.length - 1].toLowerCase();
	const needCtrl = parts.includes("Ctrl");
	const needShift = parts.includes("Shift");
	const needAlt = parts.includes("Alt");
	if (event.ctrlKey !== needCtrl) return false;
	if (event.shiftKey !== needShift) return false;
	if (event.altKey !== needAlt) return false;
	if (event.metaKey) return false;
	const eventKey = event.key.toLowerCase();
	if (/^[a-z]$/.test(key)) return eventKey === key;
	// 数字键：匹配主键盘区数字（排除小键盘）
	return event.code === `Digit${key}`;
}

interface QuickCaptureState {
	isOpen: boolean;
	captureType: QuickCaptureType;
	shortcuts: Record<QuickCaptureType, QuickCaptureShortcut>;
	open: (type: QuickCaptureType) => void;
	close: () => void;
	setShortcut: (type: QuickCaptureType, shortcut: QuickCaptureShortcut) => void;
}

export const useQuickCapture = create<QuickCaptureState>()(
	persist(
		(set) => ({
			isOpen: false,
			captureType: "note",
			shortcuts: DEFAULT_SHORTCUTS,
			open: (type) => set({ isOpen: true, captureType: type }),
			close: () => set({ isOpen: false }),
			setShortcut: (type, shortcut) =>
				set((s) => ({ shortcuts: { ...s.shortcuts, [type]: shortcut } })),
		}),
		{
			name: "quick-capture",
			partialize: (s) => ({ shortcuts: s.shortcuts }),
		},
	),
);
