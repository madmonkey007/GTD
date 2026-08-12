import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type JournalRefreshMode = "fixed" | "workHours" | "custom";

/** 时光机卡片样式模式：random=每张随机 8 种风格之一；fixed=全部使用固定风格 */
export type TimeMachineStyleMode = "random" | "fixed";

/** 时光机 8 种固定风格（对应 TimeMachineNoteCard 的 VARIANTS 下标） */
export const TIME_MACHINE_STYLE_COUNT = 8;

interface JournalSettingsState {
	refreshMode: JournalRefreshMode;
	fixedTime: string;
	workHoursStart: string;
	workHoursEnd: string;
	customTime: string;
	autoLinkEnabled: boolean;
	autoGenerateObjectiveEnabled: boolean;
	autoGenerateAiEnabled: boolean;
	/** 时光机卡片样式模式 */
	timeMachineStyleMode: TimeMachineStyleMode;
	/** 固定模式下选中的风格下标（0-7） */
	timeMachineStyle: number;
	setRefreshMode: (mode: JournalRefreshMode) => void;
	setFixedTime: (value: string) => void;
	setWorkHoursStart: (value: string) => void;
	setWorkHoursEnd: (value: string) => void;
	setCustomTime: (value: string) => void;
	setAutoLinkEnabled: (value: boolean) => void;
	setAutoGenerateObjectiveEnabled: (value: boolean) => void;
	setAutoGenerateAiEnabled: (value: boolean) => void;
	setTimeMachineStyleMode: (mode: TimeMachineStyleMode) => void;
	setTimeMachineStyle: (index: number) => void;
}

const journalStorage = {
	getItem: () => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem("journal-settings");
	},
	setItem: (_name: string, value: string) => {
		if (typeof window === "undefined") return;
		localStorage.setItem("journal-settings", value);
	},
	removeItem: () => {
		if (typeof window === "undefined") return;
		localStorage.removeItem("journal-settings");
	},
};

export const useJournalStore = create<JournalSettingsState>()(
	persist(
		(set) => ({
			refreshMode: "fixed",
			fixedTime: "04:00",
			workHoursStart: "10:00",
			workHoursEnd: "02:00",
			customTime: "04:00",
			autoLinkEnabled: false,
			autoGenerateObjectiveEnabled: false,
			autoGenerateAiEnabled: false,
			timeMachineStyleMode: "random",
			timeMachineStyle: 0,
			setRefreshMode: (mode) => set({ refreshMode: mode }),
			setFixedTime: (value) => set({ fixedTime: value }),
			setWorkHoursStart: (value) => set({ workHoursStart: value }),
			setWorkHoursEnd: (value) => set({ workHoursEnd: value }),
			setCustomTime: (value) => set({ customTime: value }),
			setAutoLinkEnabled: (value) => set({ autoLinkEnabled: value }),
			setAutoGenerateObjectiveEnabled: (value) =>
				set({ autoGenerateObjectiveEnabled: value }),
			setAutoGenerateAiEnabled: (value) =>
				set({ autoGenerateAiEnabled: value }),
			setTimeMachineStyleMode: (mode) => set({ timeMachineStyleMode: mode }),
			setTimeMachineStyle: (index) =>
				set({ timeMachineStyle: index % TIME_MACHINE_STYLE_COUNT }),
		}),
		{
			name: "journal-settings",
			storage: createJSONStorage(() => journalStorage),
			version: 3,
			migrate: (persisted, version) => {
				const s = (persisted ?? {}) as Partial<JournalSettingsState>;
				// v1 -> v2: 关闭 autoLink（纯笔记场景不需要，且每次提交触发 LLM 拖慢）
				if (version < 2) {
					s.autoLinkEnabled = false;
				}
				// v2 -> v3: 时光机卡片样式默认随机（固定风格缺省为第 0 种）
				if (version < 3) {
					s.timeMachineStyleMode = "random";
					s.timeMachineStyle = 0;
				}
				return s as JournalSettingsState;
			},
		},
	),
);
