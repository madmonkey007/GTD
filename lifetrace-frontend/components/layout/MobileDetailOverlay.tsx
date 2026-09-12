"use client";

import { motion } from "framer-motion";
import { createContext, useContext, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ChatPanel } from "@/apps/chat/ChatPanel";
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
	const mobileDetailContent = useUiStore((s) => s.mobileDetailContent);
	const isPanelBOpen = useUiStore((s) => s.isPanelBOpen);
	const togglePanelB = useUiStore((s) => s.togglePanelB);

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

	if (!isMobile || !mobileDetailOpen) return null;

	return (
		<motion.div
			className="fixed inset-0 z-50 flex flex-col bg-background shadow-xl"
			initial={{ x: "100%" }}
			animate={{ x: 0 }}
			transition={{ type: "spring", damping: 30, stiffness: 300 }}
		>
			<MobileDetailContext.Provider
				value={{ onBack: () => setMobileDetailOpen(false) }}
			>
				{mobileDetailContent === "chat" ? (
					<>
						<MobileChatHeader />
						<div className="min-h-0 flex-1">
							<ChatPanel />
						</div>
					</>
				) : (
					<TodoDetail />
				)}
			</MobileDetailContext.Provider>
		</motion.div>
	);
}

// chat 覆层的返回头栏（TodoDetail 自带头栏，chat 需要补一个）
function MobileChatHeader() {
	const setMobileDetailOpen = useUiStore((s) => s.setMobileDetailOpen);
	const tPage = useTranslations("page");

	return (
		<div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-3">
			<button
				type="button"
				onClick={() => setMobileDetailOpen(false)}
				className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
			>
				<ArrowLeft className="h-5 w-5" />
			</button>
			<span className="text-sm font-medium">{tPage("chatTitle")}</span>
		</div>
	);
}
