"use client";

import { type Driver, driver } from "driver.js";
import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { useOpenSettings } from "./useOpenSettings";

/**
 * 滚动设置面板到顶部
 */
function scrollSettingsPanelToTop(): Promise<void> {
	return new Promise((resolve) => {
		// 查找设置面板的滚动容器
		const settingsContent = document.querySelector(
			'[data-tour="settings-content"]',
		);
		if (settingsContent) {
			settingsContent.scrollTo({ top: 0, behavior: "smooth" });
			// 等待滚动完成
			setTimeout(resolve, 300);
		} else {
			resolve();
		}
	});
}

function selectSettingsCategory(category: string): void {
	window.dispatchEvent(
		new CustomEvent("settings:set-category", { detail: { category } }),
	);
}

/**
 * Hook for managing the onboarding tour
 * Provides methods to start, skip, and check tour status
 */
export function useOnboardingTour() {
	const { hasCompletedTour, completeTour, setCurrentStep } =
		useOnboardingStore();
	const { openSettings } = useOpenSettings();
	const t = useTranslations("onboarding");
	const driverRef = useRef<Driver | null>(null);

	/**
	 * Create and start the driver tour
	 */
	const createAndStartTour = useCallback(() => {
		const driverObj = driver({
			showProgress: true,
			progressText: "{{current}} / {{total}}",
			allowClose: true,
			overlayColor: "#000",
			overlayOpacity: 0.7,
			stagePadding: 10,
			stageRadius: 8,
			animate: true,
			smoothScroll: true,
			allowKeyboardControl: true,

			// Button text
			nextBtnText: t("nextBtn"),
			prevBtnText: t("prevBtn"),
			doneBtnText: t("doneBtn"),

			// Custom popover class for styling
			popoverClass: "onboarding-popover",

			// Lifecycle hooks
			onHighlightStarted: (_element, _step, { state }) => {
				setCurrentStep(state.activeIndex ?? null);
			},
			onDestroyed: () => {
				completeTour();
				setCurrentStep(null);
				window.dispatchEvent(new Event("onboarding:hide-dock-trigger-zone"));
			},

			steps: [
				// Step 1: Welcome modal - 同时打开设置面板准备下一步
				{
					popover: {
						title: t("welcomeTitle"),
						description: t("welcomeDescription"),
						side: "over" as const,
						align: "center" as const,
					},
					onHighlightStarted: () => {
						// 在欢迎步骤就打开设置面板，为下一步做准备
						openSettings();
						// 滚动到顶部
						setTimeout(() => {
							selectSettingsCategory("ai");
							scrollSettingsPanelToTop();
						}, 200);
					},
				},
				// Step 2: API Key 配置
				{
					element: "#llm-api-key",
					popover: {
						title: t("apiKeyStepTitle"),
						description: t("apiKeyStepDescription"),
						side: "bottom" as const,
						align: "start" as const,
					},
					onHighlightStarted: () => {
						// 确保元素可见
						selectSettingsCategory("ai");
						const element = document.getElementById("llm-api-key");
						if (element) {
							element.scrollIntoView({ behavior: "smooth", block: "center" });
						}
					},
				},
				// Step 3: 完成引导（底部 Dock 相关步骤已随 Dock 移除）
				{
					popover: {
						title: t("completeTitle"),
						description: t("completeDescription"),
						side: "over" as const,
						align: "center" as const,
					},
				},
			],
		});

		driverRef.current = driverObj;
		driverObj.drive();
	}, [completeTour, setCurrentStep, openSettings, t]);

	/**
	 * Start the onboarding tour (only if not completed)
	 */
	const startTour = useCallback(() => {
		if (hasCompletedTour) return;
		createAndStartTour();
	}, [hasCompletedTour, createAndStartTour]);

	/**
	 * Restart the tour (reset state and start immediately)
	 * This is used when the user wants to see the tour again
	 */
	const restartTour = useCallback(() => {
		// Reset the tour state first
		useOnboardingStore.getState().resetTour();
		// Start the tour after a short delay to ensure state is updated
		setTimeout(() => {
			createAndStartTour();
		}, 100);
	}, [createAndStartTour]);

	/**
	 * Skip the tour without completing it
	 */
	const skipTour = useCallback(() => {
		if (driverRef.current) {
			driverRef.current.destroy();
		}
		completeTour();
	}, [completeTour]);

	/**
	 * Reset the tour state to allow re-onboarding
	 */
	const resetTour = useCallback(() => {
		useOnboardingStore.getState().resetTour();
	}, []);

	return {
		startTour,
		restartTour,
		skipTour,
		resetTour,
		hasCompletedTour,
	};
}
