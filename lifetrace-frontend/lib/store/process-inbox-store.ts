import { create } from "zustand";

/**
 * GTD 整理收集箱会话状态。
 * 入口有两个（待办清单底部、Chat 输入区），提问流程渲染在 Chat 面板内。
 * start 会递增 sessionId，让 Chat 侧的会话组件重建（清空历史、从第一条开始）。
 */
interface ProcessInboxState {
	active: boolean;
	sessionId: number;
	start: () => void;
	stop: () => void;
}

export const useProcessInboxStore = create<ProcessInboxState>((set) => ({
	active: false,
	sessionId: 0,
	start: () =>
		set((s) => ({ active: true, sessionId: s.sessionId + 1 })),
	stop: () => set({ active: false }),
}));
