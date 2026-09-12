"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocaleStore } from "@/lib/store/locale";
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
// 左侧星期标签列宽（一/三/五），计入网格可用宽度
const DAY_COL = 14;
// 日历窗口长度：26 周（182 天），与统计侧 HEATMAP_DAYS 一致
const HEATMAP_DAYS = 182;
// 每分钟自检一次跨天：窗口以真实当天为准重建，最右列永远是今天所在列
const DAY_TICK_MS = 60 * 1000;
// 统计窗口 182 天 = 最多 26 周
const MAX_WEEKS = 26;
// 宽度未测得前的首帧兜底列数
const FALLBACK_WEEKS = 10;

// L17 Calendar Heat：圆面积 = 篇数（sqrt 换算），静默日一粒小点
function dotDiameter(count: number): number {
	if (count === 0) return 10;
	return Math.min(16, 7 + Math.sqrt(Math.min(count, 9)) * 3);
}

const WEEKDAY_ROWS = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_LABELS_EN = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * 自适应热力图（L17 Calendar Heat 风格）：圆点格 + 顶部月份刻度 + 左侧星期标签 +
 * 峰值日虚线圈。ResizeObserver 实测自身内容宽度，动态决定展示的周列数（不设下限），
 * 宽度缩小时只从左侧隐藏较早日期；网格右对齐，最右一列始终是包含今天的当前周。
 * 日历窗口由组件内部生成（每分钟自检跨天），不依赖统计数据的新旧。
 */
export function DiaryHeatmap({ dailyCounts, onSelectDate, selectedDate }: DiaryHeatmapProps) {
	const isZh = useLocaleStore((s) => s.locale) === "zh";
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

	// 容纳下的周列数 = floor((可用宽 - 星期列 + GAP) / (DOT + GAP))；不设最小列数，
	// 只取最右侧（最新）的 cols 周，右缘天然是今天所在列
	const visibleWeeks = useMemo(() => {
		if (containerWidth <= 0) return allWeeks.slice(-FALLBACK_WEEKS);
		const fit = Math.floor((containerWidth - DAY_COL - GAP + GAP) / (DOT + GAP));
		const cols = Math.max(1, Math.min(MAX_WEEKS, fit));
		return allWeeks.slice(-cols);
	}, [allWeeks, containerWidth]);

	const monthLabels = useMemo(() => getMonthLabelColumns(visibleWeeks), [visibleWeeks]);

	// 峰值日：可见窗口内篇数最多的一天，画 L17 的虚线圈
	const peak = useMemo(() => {
		let best: { key: string; count: number } | null = null;
		for (const week of visibleWeeks) {
			for (const day of week.days) {
				if (!day) continue;
				const key = formatDateInput(day);
				const count = dailyCounts.get(key) ?? 0;
				if (count > 0 && (!best || count > best.count)) best = { key, count };
			}
		}
		return best;
	}, [visibleWeeks, dailyCounts]);

	return (
		<div ref={containerRef} className="w-full overflow-hidden">
			{/* 月份标签在上檐：写在「包含当月 1 号」的列上方，带发丝刻度 */}
			<div className="flex justify-between" style={{ gap: GAP }}>
				<div aria-hidden="true" style={{ width: DAY_COL }} className="shrink-0" />
				{visibleWeeks.map((week, index) => {
					const label = monthLabels.find((m) => m.index === index);
					return (
						<div
							key={formatDateInput(week.weekStart)}
							className="flex h-[13px] shrink-0 flex-col items-center justify-end gap-[3px]"
							style={{ width: DOT }}
						>
							{label && (
								<>
									<span className="text-[8px] font-semibold leading-none tracking-wider text-muted-foreground/70">
										{isZh ? label.label : MONTH_NAMES_EN[Number(label.label.replace("月", "")) - 1] ?? label.label}
									</span>
									<span className="h-[3px] w-px bg-border" />
								</>
							)}
						</div>
					);
				})}
			</div>

			{/* 网格：左侧星期标签（一/三/五）+ 圆点日历列；整行两端贴齐，左侧标签贴左 */}
			<div className="mt-[3px] flex justify-between" style={{ gap: GAP }}>
				<div
					aria-hidden="true"
					className="flex shrink-0 flex-col"
					style={{ width: DAY_COL, gap: GAP }}
				>
					{Array.from({ length: 7 }, (_, row) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: 固定 7 行标签
							key={`wd-${row}`}
							className="flex h-[17px] items-center justify-start text-[8px] leading-none text-muted-foreground/50"
						>
							{WEEKDAY_LABELS_EN.includes(WEEKDAY_ROWS[row])
								? (isZh ? WEEKDAY_ROWS[row] : WEEKDAY_LABELS_EN[row])
								: ""}
						</div>
					))}
				</div>
				{visibleWeeks.map((week, weekIndex) => (
					<div
						key={formatDateInput(week.weekStart)}
						className="flex flex-col items-center"
						style={{ gap: GAP }}
					>
						{week.days.map((day, row) => {
							if (!day) {
								// 当前周里今天之后的日期：淡色小点占位（未来无数据，不可点击）
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: 占位格无稳定 key
										key={`placeholder-${row}`}
										className="flex h-[17px] w-[17px] items-center justify-center"
									>
										<span className="heat-dot h-[10px] w-[10px] rounded-full bg-heatmap-0 opacity-40" />
									</div>
								);
							}
							const key = formatDateInput(day);
							const count = dailyCounts.get(key) ?? 0;
							const tooltip = `${day.getMonth() + 1}/${day.getDate()} - ${count} ${isZh ? "篇" : count > 1 ? "notes" : "note"}`;
							const isSelected = key === selectedKey;
							const isToday = key === todayKey;
							const isPeak = peak?.key === key;
							return (
								<button
									key={key}
									type="button"
									title={tooltip}
									aria-label={`${tooltip}${isSelected ? (isZh ? "，已选中" : ", selected") : ""}${isPeak ? (isZh ? "，峰值日" : ", peak day") : ""}`}
									aria-pressed={isSelected}
									onClick={onSelectDate ? () => onSelectDate(day) : undefined}
									className={cn(
										"relative flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full transition-[box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
										onSelectDate ? "cursor-pointer" : "cursor-default",
										isSelected
											? "z-10 scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background"
											: "hover:ring-1 hover:ring-ring hover:ring-offset-1",
										isToday && !isSelected && "ring-1 ring-foreground/40",
									)}
								>
									<span
										className={cn(
											"heat-dot rounded-full",
											DOT_COLORS[getHeatmapLevel(count)],
										)}
										style={{
											width: dotDiameter(count),
											height: dotDiameter(count),
											animationDelay: `${(weekIndex * 0.012 + row * 0.004).toFixed(3)}s`,
										}}
									/>
									{isPeak && !isSelected && (
										<span
											aria-hidden="true"
											className="pointer-events-none absolute -inset-[3px] rounded-full border border-dashed border-foreground/45"
										/>
									)}
								</button>
							);
						})}
					</div>
				))}
			</div>

		</div>
	);
}
