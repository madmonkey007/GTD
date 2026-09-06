"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function DiaryHeatmap({ dailyCounts, onSelectDate, selectedDate }: DiaryHeatmapProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const windowKeyRef = useRef<string | null>(null);
	const snapTimerRef = useRef<number | null>(null);
	const snappingRef = useRef(false);
	const lastScrollLeftRef = useRef(0);
	const [, setDayTick] = useState(0);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const todayKey = formatDateInput(today);
	const selectedKey = selectedDate ? formatDateInput(selectedDate) : null;

	// 每分钟自检跨天，闲置页面过零点后窗口也能重建
	useEffect(() => {
		const timer = window.setInterval(() => setDayTick((v) => v + 1), DAY_TICK_MS);
		return () => window.clearInterval(timer);
	}, []);

	// 日历窗口由组件自己生成（始终以真实当天收尾），不依赖统计数据的新旧
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
	const weeks = useMemo(() => groupDatesByWeek(dates), [dates]);
	const monthLabels = useMemo(() => getMonthLabelColumns(weeks), [weeks]);

	// 仅在数据窗口真正变化（跨天/切换统计范围）时重新锚定到最右（今天）；
	// 轮询刷新只会替换数组身份，不能抢走用户手动滚动的位置
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const key = dates.length
			? `${formatDateInput(dates[0])}~${formatDateInput(dates[dates.length - 1])}`
			: "empty";
		if (windowKeyRef.current === key) return;
		windowKeyRef.current = key;
		snappingRef.current = false;
		el.scrollLeft = el.scrollWidth;
		lastScrollLeftRef.current = el.scrollLeft;
	}, [dates]);

	// 展开自由停靠；任何向回收（朝今天方向）的滚动在手势停稳后
	// 自动平滑收拢到最右，保证收起 = 展开的还原（右缘始终是今天所在列）
	const handleScroll = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const delta = el.scrollLeft - lastScrollLeftRef.current;
		lastScrollLeftRef.current = el.scrollLeft;
		if (snapTimerRef.current !== null) {
			window.clearTimeout(snapTimerRef.current);
			snapTimerRef.current = null;
		}
		if (snappingRef.current) {
			// 收拢动画期间用户向外拖回：立即交还控制权
			if (delta < 0) snappingRef.current = false;
			return;
		}
		if (delta > 0) {
			snapTimerRef.current = window.setTimeout(() => {
				snapTimerRef.current = null;
				snappingRef.current = true;
				el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
			}, 140);
		}
	}, []);

	useEffect(
		() => () => {
			if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
		},
		[],
	);

	const markUserScrolled = useCallback(() => {
		// 用户按下/触摸：取消进行中的收拢，交还滚动控制权
		if (snapTimerRef.current !== null) {
			window.clearTimeout(snapTimerRef.current);
			snapTimerRef.current = null;
		}
		snappingRef.current = false;
	}, []);

	return (
		<div
			ref={scrollRef}
			onScroll={handleScroll}
			onPointerDown={markUserScrolled}
			onTouchStart={markUserScrolled}
			className="max-w-full overflow-x-auto pb-1 [scrollbar-width:thin] [overscroll-behavior-x:contain]"
		>
			{/* 格子与月份标签放在同一滚动内容里，宽度同源，保证任何滚动位置下都对齐 */}
			<div className="space-y-1 w-max">
				<div className="flex" style={{ gap: GAP }}>
					{weeks.map((week) => (
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

				{/* 月份标签：与格子同宽同间距，随内容一起横向滚动，保证对齐 */}
				<div className="flex" style={{ gap: GAP }}>
					{weeks.map((week, index) => {
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
		</div>
	);
}
