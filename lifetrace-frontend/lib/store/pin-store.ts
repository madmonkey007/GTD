"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const pinStorage = {
	getItem: () => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem("journal-pins");
	},
	setItem: (_name: string, value: string) => {
		if (typeof window === "undefined") return;
		localStorage.setItem("journal-pins", value);
	},
	removeItem: () => {
		if (typeof window === "undefined") return;
		localStorage.removeItem("journal-pins");
	},
};

interface PinState {
	pinnedIds: number[];
	toggle: (id: number) => void;
}

export const usePinStore = create<PinState>()(
	persist(
		(set) => ({
			pinnedIds: [],
			toggle: (id) =>
				set((state) => ({
					pinnedIds: state.pinnedIds.includes(id)
						? state.pinnedIds.filter((pid) => pid !== id)
						: [...state.pinnedIds, id],
				})),
		}),
		{
			name: "journal-pins",
			storage: createJSONStorage(() => pinStorage),
		},
	),
);
