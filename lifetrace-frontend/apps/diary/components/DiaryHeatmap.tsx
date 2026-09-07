"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	formatDateInput,
	getMonthLabelColumns,
	groupDatesByWeek,
} from "@/apps/diary/journal-utils";
import { cn } from "@/lib/utils";

interface DiaryHeatmapProps {
	dailyCounts: Map<string, number>;
	onSelectDate?: (date: Date) => void;
	selectedDate?: Date | null;
}

function getHeatmapLevel(count: number): number {
	if (count === 0) return 0;
	if (count === 1) return 1;
	if (count <= 3) return 2;
	if (count <= 5) return 3;
	if (count <= 7) return 4;
	return 5;
}

const DOT_COLORS = [
	"bg-heatmap-0",
	"bg-heatmap-1",
	"bg-heatmap-2",
	"bg-heatmap-3",
	"bg-heatmap-4",
	"bg-heatmap-5",
];

const DOT = 17;
const GAP = 8;
// 日历窗口长度：26 周（182 天），与统计侧 HEATMAP_DAYS 一致
const HEATMAP_DAYS = 182;
// 每分钟自检一次跨天：窗口以真实当天为准重建，最右列永远是今天所在列
const DAY_TICK_MS = 60 * 1000;
// 统计窗口 182 天 = 最多 26 周
const MAX_WEEKS = 26;
// 宽度未测得前的首帧兜底列数
const FALLBACK_WEEKS = 10;

/**
 * 自适应热力图（方案 A）：ResizeObserver 实测自身内容宽度，动态决定展示的
 * 周列数（不设下限），宽度缩小时只从左侧隐藏较早日期；网格右对齐，
 * 最右一列始终是包含今天的当前周；溢出由 overflow-hidden 兜底裁剪。
 * 日历窗口由组件内部生成（每分钟自检跨天），不依赖统计数据的新旧。
 * 抽屉、桌面拖拽侧栏、窗口缩放共用同一套测量逻辑。
 */
export function DiaryHeatmap({ dailyCounts, onSelectDate, selectedDate }: DiaryHeatmapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const [, setDayTick] = useState(0);

	// 每分钟自检跨天，闲置页面过零点后窗口也能重建
	useEffect(() => {
		const timer = window.setInterval(() => setDayTick((v) => v + 1), DAY_TICK_MS);
		return () => window.clearInterval(timer);
	}, []);

	// ResizeObserver 实测容器内容宽度；侧栏拖拽/窗口缩放/抽屉开合都走这里
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			setContainerWidth(width);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// 日历窗口由组件自己生成（始终以真实当天收尾）
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const todayKey = formatDateInput(today);
	const selectedKey = selectedDate ? formatDateInput(selectedDate) : null;

	const windowStartKey = formatDateInput(
		new Date(today.getFullYear(), today.getMonth(), today.getDate() - (HEATMAP_DAYS - 1)),
	);
	const dates = useMemo(() => {
		const [y, m, d] = windowStartKey.split("-").map(Number);
		const arr: Date[] = [];
		for (let i = 0; i < HEATMAP_DAYS; i++) {
			arr.push(new Date(y, m - 1, d + i));
		}
		return arr;
	}, [windowStartKey]);

	const allWeeks = useMemo(() => groupDatesByWeek(dates), [dates]);

	// 容纳下的周列数 = floor((可用宽 + GAP) / (DOT + GAP))；不设最小列数，
	// 只取最右侧（最新）的 cols 周，右缘天然是今天所在列
	const visibleWeeks = useMemo(() => {
		if (containerWidth <= 0) return allWeeks.slice(-FALLBACK_WEEKS);
		const fit = Math.floor((containerWidth + GAP) / (DOT + GAP));
		const cols = Math.max(1, Math.min(MAX_WEEKS, fit));
		return allWeeks.slice(-cols);
	}, [allWeeks, containerWidth]);

	const monthLabels = useMemo(() => getMonthLabelColumns(visibleWeeks), [visibleWeeks]);

	return (
		<div ref={containerRef} className="w-full overflow-hidden">
			{/* justify-end：万一超宽从左侧溢出被裁剪，右缘（今天列）固定不动 */}
			<div className="flex justify-end" style={{ gap: GAP }}>
				{visibleWeeks.map((week) => (
					<div
						key={formatDateInput(week.weekStart)}
						className="flex flex-col items-center"
						style={{ gap: GAP }}
					>
						{week.days.map((day, row) => {
							if (!day) {
								// 当前周里今天之后的日期：占位空格，保持 7 行高度
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: 占位格无稳定 key
										key={`placeholder-${row}`}
										className="h-[17px] w-[17px]"
									/>
								);
							}
							const key = formatDateInput(day);
							const count = dailyCounts.get(key) ?? 0;
							const tooltip = `${day.getMonth() + 1}/${day.getDate()} - ${count} 篇`;
							const isSelected = key === selectedKey;
							const isToday = key === todayKey;
							return (
								<button
									key={key}
									type="button"
									title={tooltip}
									aria-label={`${tooltip}${isSelected ? "，已选中" : ""}`}
									aria-pressed={isSelected}
									onClick={onSelectDate ? () => onSelectDate(day) : undefined}
									className={cn(
										"h-[17px] w-[17px] shrink-0 rounded-[3px] transition-[box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
										DOT_COLORS[getHeatmapLevel(count)],
										onSelectDate ? "cursor-pointer" : "cursor-default",
										isSelected
											? "z-10 scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background"
											: "hover:ring-1 hover:ring-ring hover:ring-offset-1",
										isToday && !isSelected && "ring-1 ring-foreground/40",
									)}
								/>
							);
						})}
					</div>
				))}
			</div>

			{/* 月份标签：与格子同宽同间距、同样右对齐，任何宽度下保持列对齐 */}
			<div className="mt-1 flex justify-end" style={{ gap: GAP }}>
				{visibleWeeks.map((week, index) => {
					const label = monthLabels.find((m) => m.index === index);
					return (
						<div
							key={formatDateInput(week.weekStart)}
							className="text-[9px] text-muted-foreground/50 leading-none text-center whitespace-nowrap"
							style={{ width: DOT }}
						>
							{label ? label.label : ""}
						</div>
					);
				})}
			</div>
		</div>
	);
}
