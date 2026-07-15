"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ZeroThinkState {
	mode: "scattered" | "batch";
	hasCompletedOnboarding: boolean;
	setMode: (mode: "scattered" | "batch") => void;
	completeOnboarding: () => void;
	resetOnboarding: () => void;
}

export const useZeroThinkStore = create<ZeroThinkState>()(
	persist(
		(set) => ({
			mode: "scattered",
			hasCompletedOnboarding: false,
			setMode: (mode) => set({ mode }),
			completeOnboarding: () => set({ hasCompletedOnboarding: true }),
			resetOnboarding: () => set({ hasCompletedOnboarding: false }),
		}),
		{ name: "lifetrace-zero-think" },
	),
);
