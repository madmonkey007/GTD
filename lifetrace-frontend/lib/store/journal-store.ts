import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type JournalRefreshMode = "fixed" | "workHours" | "custom";

interface JournalSettingsState {
	refreshMode: JournalRefreshMode;
	fixedTime: string;
	workHoursStart: string;
	workHoursEnd: string;
	customTime: string;
	autoLinkEnabled: boolean;
	autoGenerateObjectiveEnabled: boolean;
	autoGenerateAiEnabled: boolean;
	setRefreshMode: (mode: JournalRefreshMode) => void;
	setFixedTime: (value: string) => void;
	setWorkHoursStart: (value: string) => void;
	setWorkHoursEnd: (value: string) => void;
	setCustomTime: (value: string) => void;
	setAutoLinkEnabled: (value: boolean) => void;
	setAutoGenerateObjectiveEnabled: (value: boolean) => void;
	setAutoGenerateAiEnabled: (value: boolean) => void;
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
		}),
		{
			name: "journal-settings",
			storage: createJSONStorage(() => journalStorage),
			version: 2,
			migrate: (persisted, version) => {
				const s = (persisted ?? {}) as Partial<JournalSettingsState>;
				// v1 -> v2: 关闭 autoLink（纯笔记场景不需要，且每次提交触发 LLM 拖慢）
				if (version < 2) {
					s.autoLinkEnabled = false;
				}
				return s as JournalSettingsState;
			},
		},
	),
);
