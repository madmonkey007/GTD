import { create } from "zustand";

type DiaryViewMode = "single" | "double";

/**
 * 移动端单标题栏工具栏状态。
 * 将原本散落在 DiaryEditor/DiaryPanel/QuickCommandPanel 中的顶栏工具状态
 * 提升到全局 store，由 MobileTopBar 统一渲染右侧按钮组。
 * 非持久化（diaryViewMode 单独持久化到 localStorage）。
 */
interface MobileToolbarState {
	// 日记视图
	diarySearchOpen: boolean;
	setDiarySearchOpen: (open: boolean) => void;
	diarySearchQuery: string;
	setDiarySearchQuery: (query: string) => void;
	diaryViewMode: DiaryViewMode;
	setDiaryViewMode: (mode: DiaryViewMode) => void;
	diaryLeftOpen: boolean;
	setDiaryLeftOpen: (open: boolean) => void;
	diaryRightOpen: boolean;
	setDiaryRightOpen: (open: boolean) => void;
	// AGENT 视图
	agentHistoryOpen: boolean;
	setAgentHistoryOpen: (open: boolean) => void;
}

export const useMobileToolbarStore = create<MobileToolbarState>((set) => ({
	diarySearchOpen: false,
	setDiarySearchOpen: (open) => set({ diarySearchOpen: open }),
	diarySearchQuery: "",
	setDiarySearchQuery: (query) => set({ diarySearchQuery: query }),
	diaryViewMode:
		typeof window !== "undefined" &&
		window.localStorage.getItem("diary-view-mode") === "double"
			? "double"
			: "single",
	setDiaryViewMode: (mode) => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem("diary-view-mode", mode);
		}
		set({ diaryViewMode: mode });
	},
	diaryLeftOpen: false,
	setDiaryLeftOpen: (open) => set({ diaryLeftOpen: open }),
	diaryRightOpen: false,
	setDiaryRightOpen: (open) => set({ diaryRightOpen: open }),
	agentHistoryOpen: false,
	setAgentHistoryOpen: (open) => set({ agentHistoryOpen: open }),
}));
