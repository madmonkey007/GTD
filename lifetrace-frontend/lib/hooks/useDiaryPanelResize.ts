/**
 * 日记侧三栏（侧边栏 / 编辑区 / AI 聊天）宽度拖拽 Hook
 * 像素宽度 + localStorage 持久化，独立于待办侧的比例式 usePanelResize
 */

import { useCallback, useRef, useState } from "react";

const LEFT_STORAGE_KEY = "lifetrace.diary.leftWidth";
const RIGHT_STORAGE_KEY = "lifetrace.diary.rightWidth";

export const DIARY_LEFT_DEFAULT = 288;
export const DIARY_RIGHT_DEFAULT = 380;
const LEFT_MIN = 220;
const LEFT_MAX = 480;
const RIGHT_MIN = 280;
const RIGHT_MAX = 640;

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const readStored = (key: string, fallback: number, min: number, max: number) => {
	if (typeof window === "undefined") return fallback;
	const raw = window.localStorage.getItem(key);
	const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
	if (Number.isNaN(parsed)) return fallback;
	return clamp(parsed, min, max);
};

export function useDiaryPanelResize() {
	const [leftWidth, setLeftWidth] = useState(() =>
		readStored(LEFT_STORAGE_KEY, DIARY_LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
	);
	const [rightWidth, setRightWidth] = useState(() =>
		readStored(RIGHT_STORAGE_KEY, DIARY_RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
	);
	const [isDraggingLeft, setIsDraggingLeft] = useState(false);
	const [isDraggingRight, setIsDraggingRight] = useState(false);
	// 拖拽过程中的最新宽度，pointerup 时持久化（避免闭包读到旧 state）
	const latestLeftRef = useRef(leftWidth);
	const latestRightRef = useRef(rightWidth);

	const beginDrag = useCallback(
		(
			event: React.PointerEvent<HTMLDivElement>,
			side: "left" | "right",
			min: number,
			max: number,
		) => {
			event.preventDefault();
			event.stopPropagation();

			const startClientX = event.clientX;
			const startWidth =
				side === "left" ? latestLeftRef.current : latestRightRef.current;
			if (side === "left") setIsDraggingLeft(true);
			else setIsDraggingRight(true);
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";

			const handlePointerMove = (moveEvent: PointerEvent) => {
				const delta = moveEvent.clientX - startClientX;
				// 左分隔条（左栏右缘）向右拖 = 左面板变宽（+delta）
				// 右分隔条（右栏左缘）向右拖 = 右面板变窄，空间让给中间（-delta）
				const next =
					side === "left"
						? clamp(startWidth + delta, min, max)
						: clamp(startWidth - delta, min, max);
				if (side === "left") {
					latestLeftRef.current = next;
					setLeftWidth(next);
				} else {
					latestRightRef.current = next;
					setRightWidth(next);
				}
			};

			const handlePointerUp = () => {
				if (side === "left") {
					setIsDraggingLeft(false);
					window.localStorage.setItem(
						LEFT_STORAGE_KEY,
						String(latestLeftRef.current),
					);
				} else {
					setIsDraggingRight(false);
					window.localStorage.setItem(
						RIGHT_STORAGE_KEY,
						String(latestRightRef.current),
					);
				}
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("pointermove", handlePointerMove);
				window.removeEventListener("pointerup", handlePointerUp);
			};

			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		},
		[],
	);

	const handleLeftResizePointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			beginDrag(event, "left", LEFT_MIN, LEFT_MAX);
		},
		[beginDrag],
	);

	const handleRightResizePointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			beginDrag(event, "right", RIGHT_MIN, RIGHT_MAX);
		},
		[beginDrag],
	);

	return {
		leftWidth,
		rightWidth,
		isDraggingLeft,
		isDraggingRight,
		handleLeftResizePointerDown,
		handleRightResizePointerDown,
	};
}
