"use client";

import { create } from "zustand";

/**
 * 番茄钟"待专注任务"。
 * 待办详情点击「开始专注」时写入任务标题并切换到番茄钟视图；
 * PomodoroView 挂载后读取、自动开始计时并展示任务名，然后清空。
 */
interface PomodoroFocusState {
	pendingTaskTitle: string | null;
	startFocus: (title: string) => void;
	clearPendingTask: () => void;
}

export const usePomodoroFocus = create<PomodoroFocusState>((set) => ({
	pendingTaskTitle: null,
	startFocus: (title) => set({ pendingTaskTitle: title }),
	clearPendingTask: () => set({ pendingTaskTitle: null }),
}));
