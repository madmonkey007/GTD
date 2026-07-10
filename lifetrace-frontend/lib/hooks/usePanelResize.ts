/**
 * Panel A 和 Panel C 调整大小 Hook
 * 处理 Panel A 和 Panel C 的宽度调整逻辑
 */

import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback } from "react";

interface UsePanelResizeOptions {
	containerRef: React.RefObject<HTMLDivElement | null>;
	isPanelBOpen: boolean;
	isPanelCOpen: boolean;
	panelCWidth: number;
	setPanelAWidth: (width: number) => void;
	setPanelCWidth: (width: number) => void;
	setIsDraggingPanelA: (isDragging: boolean) => void;
	setIsDraggingPanelC: (isDragging: boolean) => void;
	setGlobalResizeCursor: (enabled: boolean) => void;
	/** 侧边栏占用的偏移宽度（如 56px），用于修正比率计算 */
	sidebarOffset?: number;
}

export function usePanelResize({
	containerRef,
	isPanelBOpen,
	isPanelCOpen,
	panelCWidth,
	setPanelAWidth,
	setPanelCWidth,
	setIsDraggingPanelA,
	setIsDraggingPanelC,
	setGlobalResizeCursor,
	sidebarOffset = 0,
}: UsePanelResizeOptions) {
	const getPanelRect = useCallback(() => {
		const container = containerRef.current;
		if (!container) return null;
		const rect = container.getBoundingClientRect();
		if (sidebarOffset > 0) {
			return {
				left: rect.left + sidebarOffset,
				width: Math.max(rect.width - sidebarOffset, 1),
			};
		}
		return { left: rect.left, width: rect.width };
	}, [containerRef, sidebarOffset]);

	const handlePanelADragAtClientX = useCallback(
		(clientX: number) => {
			const panelRect = getPanelRect();
			if (!panelRect || panelRect.width <= 0) return;

			const relativeX = clientX - panelRect.left;
			const ratio = relativeX / panelRect.width;

			// 当 panelC 打开时，panelA 的宽度是相对于 baseWidth 的比例
			// baseWidth = 1 - panelCWidth
			// 所以需要将 ratio 转换为相对于 baseWidth 的比例
			if (isPanelCOpen && isPanelBOpen) {
				const baseWidth = 1 - panelCWidth;
				if (baseWidth > 0) {
					const adjustedRatio = ratio / baseWidth;
					setPanelAWidth(adjustedRatio);
				} else {
					setPanelAWidth(0.5);
				}
			} else {
				setPanelAWidth(ratio);
			}
		},
		[setPanelAWidth, isPanelCOpen, isPanelBOpen, panelCWidth, getPanelRect],
	);

	const handlePanelCDragAtClientX = useCallback(
		(clientX: number) => {
			const panelRect = getPanelRect();
			if (!panelRect || panelRect.width <= 0) return;

			const relativeX = clientX - panelRect.left;
			const ratio = relativeX / panelRect.width;
			// panelCWidth 是从右侧开始计算的，所以是 1 - ratio
			setPanelCWidth(1 - ratio);
		},
		[setPanelCWidth, getPanelRect],
	);

	const handlePanelAResizePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();

			setIsDraggingPanelA(true);
			setGlobalResizeCursor(true);
			handlePanelADragAtClientX(event.clientX);

			const handlePointerMove = (moveEvent: PointerEvent) => {
				handlePanelADragAtClientX(moveEvent.clientX);
			};

			const handlePointerUp = () => {
				setIsDraggingPanelA(false);
				setGlobalResizeCursor(false);
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		},
		[handlePanelADragAtClientX, setIsDraggingPanelA, setGlobalResizeCursor],
	);

	const handlePanelCResizePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();

			setIsDraggingPanelC(true);
			setGlobalResizeCursor(true);
			handlePanelCDragAtClientX(event.clientX);

			const handlePointerMove = (moveEvent: PointerEvent) => {
				handlePanelCDragAtClientX(moveEvent.clientX);
			};

			const handlePointerUp = () => {
				setIsDraggingPanelC(false);
				setGlobalResizeCursor(false);
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		},
		[handlePanelCDragAtClientX, setIsDraggingPanelC, setGlobalResizeCursor],
	);

	return {
		handlePanelAResizePointerDown,
		handlePanelCResizePointerDown,
	};
}
