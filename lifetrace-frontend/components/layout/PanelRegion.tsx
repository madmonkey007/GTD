"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarPanel } from "@/apps/calendar/CalendarPanel";
import { HabitsPanel } from "@/apps/habits/HabitsPanel";
import { DiaryPanel } from "@/apps/diary";
import { AchievementsPanel } from "@/apps/achievements/AchievementsPanel";
import { ZeroThinkPanel } from "@/apps/zero-think";
import { PomodoroView } from "@/apps/pomodoro/PomodoroView";
import { QuadrantsView } from "@/apps/quadrants/QuadrantsView";
import { QuickCommandPanel } from "@/apps/quick-command/QuickCommandPanel";
import { ProfilePanel } from "./ProfilePanel";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWindowAdaptivePanels } from "@/lib/hooks/useWindowAdaptivePanels";
import { useUiStore } from "@/lib/store/ui-store";
import { useTodoStore } from "@/lib/store/todo-store";
import type { SidebarView } from "@/lib/store/ui-store/types";
import { cn } from "@/lib/utils";
import { FilterColumn } from "./FilterColumn";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileDetailOverlay } from "./MobileDetailOverlay";
import { MobileTopBar } from "./MobileTopBar";
import { PanelContainer } from "./PanelContainer";
import { PanelContent } from "./PanelContent";
import { SettingsModal } from "./SettingsModal";
import { ResizeHandle } from "./ResizeHandle";
import { SidebarNav } from "./SidebarNav";

// ========== 布局常量 ==========
const SIDEBAR_WIDTH = 56; // 固定 w-14

interface PanelRegionProps {
	width: number;
	height?: number;
	isMaximizeMode?: boolean;
	isInPanelMode?: boolean;
	isDraggingPanelA?: boolean;
	isDraggingPanelC?: boolean;
	isResizingPanel?: boolean;
	onPanelAResizePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
	onPanelCResizePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
	containerRef?: React.RefObject<HTMLDivElement | null>;
}


function ListPanels({
	width,
	mounted,
	isDraggingPanelA,
	isDraggingPanelC,
	isResizingPanel,
	onPanelAResizePointerDown,
	onPanelCResizePointerDown,
	onPanelsReady,
}: {
	width: number;
	mounted: boolean;
	isDraggingPanelA: boolean;
	isDraggingPanelC: boolean;
	isResizingPanel: boolean;
	onPanelAResizePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
	onPanelCResizePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
	isInPanelMode: boolean;
	onPanelsReady: (containerRef: React.RefObject<HTMLDivElement | null>, bottomDockRef: React.RefObject<HTMLDivElement | null>) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const bottomDockContainerRef = useRef<HTMLDivElement>(null);
	const {
		isPanelAOpen,
		isPanelBOpen,
		isPanelCOpen,
		panelAWidth,
		panelCWidth,
		panelFeatureMap,
	} = useUiStore();
	// 代办详情面板只在选中了 todo 时才有意义：未选中时不展示，避免空面板占位。
	const selectedTodoId = useTodoStore((s) => s.selectedTodoId);
	const hasTodoSelection = selectedTodoId != null;
	// 某面板若承载 todoDetail 且当前无选中，则隐藏（不占宽度）
	const hideIfEmptyDetail = (pos: "panelA" | "panelB" | "panelC") =>
		!hasTodoSelection && panelFeatureMap[pos] === "todoDetail";

	useWindowAdaptivePanels(containerRef);

	// 面板挂载门槛，与 useWindowAdaptivePanels 的 MIN_PANEL_WIDTH_PX(300) 对齐：
	// 2 个面板需 ≥2*300=600，3 个面板需 ≥3*300=900。之前 Panel C 门槛是 1200，
	// 远高于自适应规则，导致拉宽窗口时代办详情(800)先出现并被拉得很宽，
	// 而 chat 要到 1476px 窗口才出现，多数屏幕够不到。
	const PANEL_DUAL_THRESHOLD = 600;
	const PANEL_TRIPLE_THRESHOLD = 900;
	const shouldShowPanelB = mounted ? width >= PANEL_DUAL_THRESHOLD : false;
	const shouldShowPanelC = mounted ? width >= PANEL_TRIPLE_THRESHOLD : false;

	const panelAVisible = (mounted ? isPanelAOpen : true) && !hideIfEmptyDetail("panelA");
	const panelBVisible = (mounted ? isPanelBOpen : false) && !hideIfEmptyDetail("panelB");
	const panelCVisible = (mounted ? isPanelCOpen : false) && !hideIfEmptyDetail("panelC");

	const showPanelA = panelAVisible;
	const showPanelB = shouldShowPanelB && panelBVisible;
	const showPanelC = shouldShowPanelC && panelCVisible;
	const showPanelAHandle = showPanelA && showPanelB;
	const showPanelCHandle = showPanelC && (showPanelB || showPanelA);
	const isACOnly = showPanelA && showPanelC && !showPanelB;

	const layoutState = useMemo(() => {
		if (!mounted) {
			return { panelAWidth: 1, panelBWidth: 0, panelCWidth: 0 };
		}

		const clampedPanelA = Math.min(Math.max(panelAWidth, 0.1), 0.9);

		if (showPanelA && showPanelB && showPanelC) {
			const baseWidth = 1 - panelCWidth;
			const safeBase = baseWidth > 0 ? baseWidth : 1;
			const a = safeBase * clampedPanelA;
			const c = panelCWidth;
			const b = Math.max(0, 1 - a - c);
			return { panelAWidth: a, panelBWidth: b, panelCWidth: c };
		}

		if (showPanelA && !showPanelB && showPanelC) {
			return { panelAWidth: clampedPanelA, panelBWidth: 0, panelCWidth: 1 - clampedPanelA };
		}

		if (showPanelA && showPanelB && !showPanelC) {
			return { panelAWidth: clampedPanelA, panelBWidth: 1 - clampedPanelA, panelCWidth: 0 };
		}

		if (!showPanelA && showPanelB && showPanelC) {
			const baseWidth = 1 - panelCWidth;
			const safeBase = baseWidth > 0 ? baseWidth : 1;
			return { panelAWidth: 0, panelBWidth: safeBase, panelCWidth: panelCWidth };
		}

		if (showPanelA && !showPanelB && !showPanelC) {
			return { panelAWidth: 1, panelBWidth: 0, panelCWidth: 0 };
		}

		if (!showPanelA && showPanelB && !showPanelC) {
			return { panelAWidth: 0, panelBWidth: 1, panelCWidth: 0 };
		}

		if (!showPanelA && !showPanelB && showPanelC) {
			return { panelAWidth: 0, panelBWidth: 0, panelCWidth: 1 };
		}

		return { panelAWidth: 1, panelBWidth: 0, panelCWidth: 0 };
	}, [mounted, showPanelA, showPanelB, showPanelC, panelAWidth, panelCWidth]);

	// 通知父组件容器 refs
	useEffect(() => {
		onPanelsReady(containerRef, bottomDockContainerRef);
	}, []);

	return (
		<div className="flex flex-col flex-1 min-w-0">
			{/* Panels 行 */}
			<div
				ref={containerRef}
				className="relative flex flex-1 min-w-0 overflow-hidden gap-1"
			>
				<PanelContainer
					key="panelA"
					position="panelA"
					isVisible={panelAVisible}
					width={
						shouldShowPanelC
							? layoutState.panelAWidth
							: shouldShowPanelB
								? layoutState.panelAWidth
								: 1
					}
					isDragging={isDraggingPanelA || isDraggingPanelC || isResizingPanel}
				>
					<PanelContent position="panelA" />
				</PanelContainer>

				{shouldShowPanelB && (
					<>
						<ResizeHandle
							key="panelA-resize-handle"
							onPointerDown={onPanelAResizePointerDown || (() => {})}
							isDragging={isDraggingPanelA}
							isVisible={showPanelAHandle}
						/>

						<PanelContainer
							key="panelB"
							position="panelB"
							isVisible={panelBVisible}
							width={
								shouldShowPanelC
									? layoutState.panelBWidth
									: 1 - layoutState.panelAWidth
							}
							isDragging={isDraggingPanelA || isDraggingPanelC || isResizingPanel}
						>
							<PanelContent position="panelB" />
						</PanelContainer>
					</>
				)}

				{shouldShowPanelC && (
					<>
						<ResizeHandle
							key="panelC-resize-handle"
							onPointerDown={
								(isACOnly
									? onPanelAResizePointerDown
									: onPanelCResizePointerDown) || (() => {})
							}
							isDragging={isACOnly ? isDraggingPanelA : isDraggingPanelC}
							isVisible={showPanelCHandle}
						/>

						<PanelContainer
							key="panelC"
							position="panelC"
							isVisible={panelCVisible}
							width={layoutState.panelCWidth}
							isDragging={isDraggingPanelA || isDraggingPanelC || isResizingPanel}
						>
							<PanelContent position="panelC" />
						</PanelContainer>
					</>
				)}
			</div>

			<SettingsModal />
			<MobileDetailOverlay />
		</div>
	);
}

/**
 * PanelRegion 组件
 * 包含固定侧边栏（56px 图标导航）和根据 activeView 切换的主内容区
 */
export function PanelRegion({
	width,
	height,
	isInPanelMode = true,
	isDraggingPanelA = false,
	isDraggingPanelC = false,
	isResizingPanel = false,
	onPanelAResizePointerDown,
	onPanelCResizePointerDown,
	containerRef: externalContainerRef,
}: PanelRegionProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const sidebarPanelsRef = useRef<HTMLDivElement>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const { activeView, sidebarWidth, setActiveView } = useUiStore();
	const isMobile = useIsMobile();

	// 计算容器高度
	const panelsContainerHeight = useMemo(() => {
		if (height && height > 0) {
			return height;
		}
		return undefined;
	}, [height]);

	// 强制固定高度
	useLayoutEffect(() => {
		const wrapper = sidebarPanelsRef.current;
		if (!wrapper || !panelsContainerHeight) return;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (wrapper && panelsContainerHeight) {
					wrapper.style.setProperty("height", `${panelsContainerHeight}px`, "important");
					wrapper.style.setProperty("min-height", `${panelsContainerHeight}px`, "important");
					wrapper.style.setProperty("max-height", `${panelsContainerHeight}px`, "important");
				}
			});
		});
	}, [panelsContainerHeight]);

	// 将 ListPanels 容器的 ref 传递给父组件，用于 resize 计算
	const handlePanelsReady = useCallback((
		panelsContainerRef: React.RefObject<HTMLDivElement | null>,
		_bottomDockRef: React.RefObject<HTMLDivElement | null>,
	) => {
		if (externalContainerRef && "current" in externalContainerRef) {
			(externalContainerRef as React.MutableRefObject<HTMLDivElement | null>).current =
				panelsContainerRef.current;
		}
	}, [externalContainerRef]);

	return (
		<div
			ref={containerRef}
			className="flex flex-col h-full w-full"
			style={{ opacity: 1 }}
		>
			<div
				ref={sidebarPanelsRef}
				className={cn(
					"relative flex flex-col min-h-0 overflow-hidden bg-gray-100/60 dark:bg-zinc-900/20",
					panelsContainerHeight ? "" : "flex-1",
				)}
				style={{
					pointerEvents: "auto",
					opacity: 1,
					...(panelsContainerHeight
						? {
								height: `${panelsContainerHeight}px`,
								minHeight: `${panelsContainerHeight}px`,
								maxHeight: `${panelsContainerHeight}px`,
							}
						: {}),
				}}
			>
			{isMobile && <MobileTopBar />}
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
			{/* 左侧固定导航侧边栏 */}
			{!isMobile && (
			<div
				className="flex flex-col h-full shrink-0 border-r border-border/40 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
				style={{ width: `${SIDEBAR_WIDTH}px` }}
			>
				<SidebarNav />
			</div>
			)}

				{/* 主内容区 */}
				<div
						className={cn(
							"relative flex flex-1 min-w-0 overflow-hidden gap-1.5",
							activeView !== "list" && "bg-background",
							activeView !== "diary" && "py-1.5",
						)}
					>
					{activeView === "list" && !isMobile && <FilterColumn />}
					{activeView === "list" ? (
						<ListPanels
							width={width - (isMobile ? 0 : SIDEBAR_WIDTH + (activeView === "list" ? sidebarWidth : 0))}
							mounted={mounted}
							isDraggingPanelA={isDraggingPanelA}
							isDraggingPanelC={isDraggingPanelC}
							isResizingPanel={isResizingPanel}
							onPanelAResizePointerDown={onPanelAResizePointerDown}
							onPanelCResizePointerDown={onPanelCResizePointerDown}
							isInPanelMode={isInPanelMode}
							onPanelsReady={handlePanelsReady}
						/>
					) : (
						<div className="flex-1 overflow-hidden">
							{activeView === "calendar" && <CalendarPanel />}
							{activeView === "quadrants" && <QuadrantsView />}
							{activeView === "pomodoro" && <PomodoroView />}
							{activeView === "habits" && <HabitsPanel />}
							{activeView === "diary" && <DiaryPanel />}
							{activeView === "achievements" && <AchievementsPanel />}
							{activeView === "zeroThink" && <ZeroThinkPanel setActiveView={(view: string) => setActiveView(view as SidebarView)} />}
							{activeView === "quickCommand" && <QuickCommandPanel />}
							{activeView === "profile" && <ProfilePanel />}
						</div>
					)}
				</div>
			</div>
			{isMobile && <MobileBottomNav />}
			<SettingsModal />
		</div>
	</div>
	);
}
