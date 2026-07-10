"use client";

import { Award, BookOpen, CalendarDays, Heart, LayoutGrid, ListTodo, Timer } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarPanel } from "@/apps/calendar/CalendarPanel";
import { HabitsPanel } from "@/apps/habits/HabitsPanel";
import { DiaryPanel } from "@/apps/diary";
import { AchievementsPanel } from "@/apps/achievements/AchievementsPanel";
import { PomodoroView } from "@/apps/pomodoro/PomodoroView";
import { QuadrantsView } from "@/apps/quadrants/QuadrantsView";
import { useWindowAdaptivePanels } from "@/lib/hooks/useWindowAdaptivePanels";
import { useUiStore } from "@/lib/store/ui-store";
import type { SidebarView } from "@/lib/store/ui-store/types";
import { cn } from "@/lib/utils";
import { BottomDock } from "./BottomDock";
import { FilterColumn } from "./FilterColumn";
import { PanelContainer } from "./PanelContainer";
import { PanelContent } from "./PanelContent";
import { SettingsModal } from "./SettingsModal";
import { ResizeHandle } from "./ResizeHandle";

// ========== 布局常量 ==========
const BOTTOM_DOCK_HEIGHT = 60;
const DOCK_MARGIN_TOP = 0;
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

const SIDEBAR_NAV_ITEMS: {
	id: SidebarView;
	label: string;
	icon: typeof ListTodo;
}[] = [
	{ id: "list", label: "清单", icon: ListTodo },
	{ id: "calendar", label: "日历", icon: CalendarDays },
	{ id: "quadrants", label: "四象限", icon: LayoutGrid },
	{ id: "pomodoro", label: "番茄时钟", icon: Timer },
	{ id: "habits", label: "习惯", icon: Heart },
	{ id: "diary", label: "笔记", icon: BookOpen },
	{ id: "achievements", label: "成就", icon: Award },
];

function SidebarNav() {
	const { activeView, setActiveView } = useUiStore();

	return (
		<nav className="flex flex-col items-center gap-1 py-3">
			{SIDEBAR_NAV_ITEMS.map((item) => {
				const Icon = item.icon;
				const isActive = activeView === item.id;
				return (
					<button
						key={item.id}
						type="button"
						onClick={() => setActiveView(item.id)}
						title={item.label}
						className={cn(
							"group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
							"hover:bg-muted/50",
							isActive
								? "bg-primary/10 text-primary"
								: "text-muted-foreground",
						)}
					>
						{isActive && (
							<div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
						)}
						<Icon className="h-5 w-5" />
					</button>
				);
			})}
		</nav>
	);
}


function ListPanels({
	width,
	mounted,
	isDraggingPanelA,
	isDraggingPanelC,
	isResizingPanel,
	onPanelAResizePointerDown,
	onPanelCResizePointerDown,
	isInPanelMode,
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
		dockDisplayMode,
	} = useUiStore();

	useWindowAdaptivePanels(containerRef);

	const PANEL_DUAL_THRESHOLD = 800;
	const PANEL_TRIPLE_THRESHOLD = 1200;
	const shouldShowPanelB = mounted ? width >= PANEL_DUAL_THRESHOLD : false;
	const shouldShowPanelC = mounted ? width >= PANEL_TRIPLE_THRESHOLD : false;

	const panelAVisible = mounted ? isPanelAOpen : true;
	const panelBVisible = mounted ? isPanelBOpen : false;
	const panelCVisible = mounted ? isPanelCOpen : false;

	const showPanelA = panelAVisible;
	const showPanelB = shouldShowPanelB && panelBVisible;
	const showPanelC = shouldShowPanelC && panelCVisible;
	const showPanelAHandle = showPanelA && showPanelB;
	const showPanelCHandle = showPanelC && (showPanelB || showPanelA);
	const isACOnly = showPanelA && showPanelC && !showPanelB;

	const visiblePanelCount = useMemo(() => {
		if (shouldShowPanelC) return 3;
		if (shouldShowPanelB) return 2;
		return 1;
	}, [shouldShowPanelB, shouldShowPanelC]);

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

			{/* BottomDock */}
			{dockDisplayMode !== "auto-hide" && (
			<div
				ref={(el) => {
					(bottomDockContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
					if (el) {
						requestAnimationFrame(() => {
							if (el) {
								el.style.setProperty("height", `${BOTTOM_DOCK_HEIGHT}px`, "important");
								el.style.setProperty("min-height", `${BOTTOM_DOCK_HEIGHT}px`, "important");
								el.style.setProperty("max-height", `${BOTTOM_DOCK_HEIGHT}px`, "important");
							}
						});
					}
				}}
				className="relative flex shrink-0 items-center justify-center"
				style={{
					pointerEvents: "auto",
					height: BOTTOM_DOCK_HEIGHT,
					marginTop: DOCK_MARGIN_TOP,
				}}
			>
				<BottomDock
					className={isInPanelMode ? "!relative !bottom-auto !left-auto !translate-x-0" : undefined}
					isInPanelMode={isInPanelMode}
					panelContainerRef={bottomDockContainerRef as React.RefObject<HTMLElement | null>}
					visiblePanelCount={visiblePanelCount}
				/>
			</div>
			)}
			<SettingsModal />
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

	const { activeView, sidebarWidth } = useUiStore();

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
					"relative flex min-h-0 overflow-hidden bg-gray-100/60 dark:bg-zinc-900/20",
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
				{/* 左侧固定导航侧边栏 */}
				<div
					className="flex flex-col overflow-hidden shrink-0 border-r border-border/40"
					style={{ width: `${SIDEBAR_WIDTH}px` }}
				>
					<SidebarNav />
				</div>

				{/* 主内容区 */}
				<div
						className={cn(
							"relative flex flex-1 min-w-0 overflow-hidden gap-1.5",
							activeView !== "list" && "bg-background",
							activeView !== "diary" && "py-1.5",
						)}
					>
					{activeView === "list" && <FilterColumn />}
					{activeView === "list" ? (
						<ListPanels
							width={width - SIDEBAR_WIDTH - (activeView === "list" ? sidebarWidth : 0)}
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
						</div>
					)}
				</div>
			</div>
			<SettingsModal />
		</div>
	);
}
