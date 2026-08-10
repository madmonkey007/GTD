"use client";

import { motion } from "framer-motion";
import { createContext, useContext, useEffect } from "react";
import { ProjectDetail } from "@/apps/project";
import { TodoDetail } from "@/apps/todo-detail";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useUiStore } from "@/lib/store/ui-store";

type MobileDetailValue = { onBack: () => void };

const MobileDetailContext = createContext<MobileDetailValue | null>(null);

export function useMobileDetail(): MobileDetailValue | null {
	return useContext(MobileDetailContext);
}

export function MobileDetailOverlay() {
	const isMobile = useIsMobile();
	const mobileDetailOpen = useUiStore((s) => s.mobileDetailOpen);
	const setMobileDetailOpen = useUiStore((s) => s.setMobileDetailOpen);
	const isPanelBOpen = useUiStore((s) => s.isPanelBOpen);
	const togglePanelB = useUiStore((s) => s.togglePanelB);
	const isPanelCOpen = useUiStore((s) => s.isPanelCOpen);
	const togglePanelC = useUiStore((s) => s.togglePanelC);
	const panelFeatureMap = useUiStore((s) => s.panelFeatureMap);
	const selectedProjectId = useUiStore((s) => s.selectedProjectId);

	// 跨断点同步：窄屏↔宽屏切换时保持待办详情可见性连续
	useEffect(() => {
		if (isMobile && isPanelBOpen && !mobileDetailOpen) {
			setMobileDetailOpen(true);
			togglePanelB();
		} else if (!isMobile && mobileDetailOpen) {
			setMobileDetailOpen(false);
			if (!isPanelBOpen) {
				togglePanelB();
			}
		}
	}, [
		isMobile,
		isPanelBOpen,
		mobileDetailOpen,
		setMobileDetailOpen,
		togglePanelB,
	]);

	if (!isMobile) return null;

	// 项目详情：移动端 panelC 因宽度门槛不渲染，改由全屏 overlay 展示（与 panelC 状态联动）
	const showTodoDetail = mobileDetailOpen;
	const showProjectDetail =
		isPanelCOpen &&
		panelFeatureMap.panelC === "projectDetail" &&
		selectedProjectId != null;

	if (!showTodoDetail && !showProjectDetail) return null;

	return (
		<>
			{showTodoDetail && (
				<motion.div
					className="fixed inset-0 z-50 flex flex-col bg-background shadow-xl"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					transition={{ type: "spring", damping: 30, stiffness: 300 }}
				>
					<MobileDetailContext.Provider
						value={{ onBack: () => setMobileDetailOpen(false) }}
					>
						<TodoDetail />
					</MobileDetailContext.Provider>
				</motion.div>
			)}
			{showProjectDetail && (
				<motion.div
					className="fixed inset-0 z-50 flex flex-col bg-background shadow-xl"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					transition={{ type: "spring", damping: 30, stiffness: 300 }}
				>
					<MobileDetailContext.Provider
						value={{ onBack: () => togglePanelC() }}
					>
						<ProjectDetail
							projectId={selectedProjectId}
							onBack={() => togglePanelC()}
						/>
					</MobileDetailContext.Provider>
				</motion.div>
			)}
		</>
	);
}
