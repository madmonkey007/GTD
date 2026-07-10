"use client";

import { useCallback } from "react";
import { useUiStore } from "@/lib/store/ui-store";

/**
 * 打开设置弹窗
 * 现在设置面板以弹窗形式展示，不再占用面板位置
 */
export function useOpenSettings() {
	const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);

	const openSettings = useCallback(() => {
		const current = useUiStore.getState().isSettingsOpen;
		setSettingsOpen(!current);
	}, [setSettingsOpen]);

	return { openSettings };
}
