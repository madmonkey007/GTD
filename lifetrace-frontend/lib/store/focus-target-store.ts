"use client";

import { create } from "zustand";

/**
 * 跨面板的"待聚焦目标"。
 * agent 面板创建实体后，点击卡片「查看」按钮时写入；
 * 对应面板（笔记 / 习惯）挂载并加载数据后读取并选中该条，然后清空。
 * 待办走全局 todo-store 的 selectedTodoId，不经过这里。
 */
export type FocusTarget = {
	feature: "note" | "habit";
	id: string;
};

interface FocusTargetState {
	target: FocusTarget | null;
	setTarget: (t: FocusTarget | null) => void;
}

export const useFocusTarget = create<FocusTargetState>((set) => ({
	target: null,
	setTarget: (t) => set({ target: t }),
}));
