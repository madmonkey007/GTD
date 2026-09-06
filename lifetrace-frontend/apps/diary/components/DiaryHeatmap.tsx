"use client";

import { useEffect, useMemo, useRef } from "react";
import {
	formatDateInput,
	getMonthLabelColumns,
	groupDatesByWeek,
} from "@/apps/diary/journal-utils";
import { cn } from "@/lib/utils";

interface DiaryHeatmapProps {
	dates: Date[];
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

export function DiaryHeatmap({ dates, dailyCounts, onSelectDate, selectedDate }: DiaryHeatmapProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const todayKey = formatDateInput(today);
	const selectedKey = selectedDate ? formatDateInput(selectedDate) : null;

	const weeks = useMemo(() => groupDatesByWeek(dates), [dates]);
	const monthLabels = useMemo(() => getMonthLabelColumns(weeks), [weeks]);

	// 默认视口停在最新一列（今天在最右），向左拖动才逐步露出更早的日期
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollLeft = el.scrollWidth;
		// biome-ignore lint/correctness/useExhaustiveDependencies: 数据变化后需重新滚到最右
	}, [weeks]);

	return (
		<div
			ref={scrollRef}
			className="overflow-x-auto pb-1 [scrollbar-width:thin]"
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
