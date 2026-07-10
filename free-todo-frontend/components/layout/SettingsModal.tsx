"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { SettingsPanel } from "@/apps/settings/SettingsPanel";
import { useUiStore } from "@/lib/store/ui-store";

/**
 * 设置弹窗组件
 * 覆盖在 PanelRegion 之上的全屏弹窗，用于替代原来的面板式设置
 */
export function SettingsModal() {
	const isSettingsOpen = useUiStore((state) => state.isSettingsOpen);
	const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
	const overlayRef = useRef<HTMLDivElement>(null);

	// 关闭弹窗
	const handleClose = () => setSettingsOpen(false);

	// Escape 键关闭
	useEffect(() => {
		if (!isSettingsOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleClose();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isSettingsOpen, handleClose]);

	// 切换时锁定/释放 body 滚动
	useEffect(() => {
		if (isSettingsOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [isSettingsOpen]);

	// 点击蒙层关闭
	const handleOverlayClick = (e: React.MouseEvent) => {
		if (e.target === overlayRef.current) {
			handleClose();
		}
	};

	if (!isSettingsOpen) return null;

	return (
		<div
			ref={overlayRef}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
			onClick={handleOverlayClick}
		>
			<div
				className="relative flex flex-col overflow-hidden rounded-xl border border-border/40 bg-background shadow-2xl"
				style={{
					width: "min(90vw, 800px)",
					height: "min(85vh, 700px)",
					minWidth: "400px",
				}}
			>
				{/* 关闭按钮 */}
				<button
					type="button"
					onClick={handleClose}
					className="absolute right-3 top-3 z-20 flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
					aria-label="关闭设置"
				>
					<X className="h-4 w-4" />
				</button>

				{/* 设置面板内容 */}
				<div className="flex-1 overflow-hidden">
					<SettingsPanel />
				</div>
			</div>
		</div>
	);
}
