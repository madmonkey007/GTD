"use client";

import { useMemo } from "react";
import { formatDateInput } from "@/apps/diary/journal-utils";

interface DiaryHeatmapProps {
	dates: Date[];
	dailyCounts: Map<string, number>;
	onSelectDate?: (date: Date) => void;
	/** 容器宽度（内联模式 = 左栏拖拽宽度），用于自适应列数；抽屉模式不传则默认 11 列 */
	containerWidth?: number;
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
const DEFAULT_COLS = 11;
const MAX_COLS = 26; // 最多覆盖 26 周（182 天），对应左栏最宽（480px）时的宽度

export function DiaryHeatmap({ dates, dailyCounts, onSelectDate, containerWidth }: DiaryHeatmapProps) {
	const cols = useMemo(() => {
		if (containerWidth !== undefined) {
			// 按容器宽度估算可容纳的列数：每列 = DOT 宽 + GAP 间距
			const fit = Math.floor((containerWidth - GAP - 4) / (DOT + GAP));
			return Math.min(MAX_COLS, Math.max(DEFAULT_COLS, fit));
		}
		return DEFAULT_COLS;
	}, [containerWidth]);

	// dates 每天 1 条、按时间正序（index 0 = 最早）。固定只显示「最近 cols*rows 天」：
	// 截取 dates 末尾的 visible 天，列优先铺开，第 0 列 = 最早、最后一列 = 最新（贴近当前月）。
	const grid = useMemo(() => {
		const rows = 7;
		const visible = cols * rows;
		const offset = Math.max(0, dates.length - visible);
		const cells: { date: Date; level: number; tooltip: string }[][] = [];

		for (let col = 0; col < cols; col++) {
			const column: { date: Date; level: number; tooltip: string }[] = [];
			for (let row = 0; row < rows; row++) {
				const index = offset + col * rows + row;
				if (index < dates.length) {
					const date = dates[index];
					const key = formatDateInput(date);
					const count = dailyCounts.get(key) ?? 0;
					const level = getHeatmapLevel(count);
					const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
					column.push({
						date,
						level,
						tooltip: `${dateStr} - ${count} 篇`,
					});
				} else {
					column.push({ date: new Date(), level: 0, tooltip: "" });
				}
			}
			cells.push(column);
		}
		return cells;
	}, [dates, dailyCounts, cols]);

	const monthLabels = useMemo(() => {
		const labels: { label: string; col: number }[] = [];
		let lastMonth = -1;
		const offset = Math.max(0, dates.length - cols * 7);
		for (let col = 0; col < cols; col++) {
			const index = offset + col * 7;
			if (index < dates.length) {
				const month = dates[index].getMonth();
				if (month !== lastMonth) {
					labels.push({
						label: `${dates[index].getMonth() + 1}月`,
						col,
					});
					lastMonth = month;
				}
			}
		}
		if (labels.length > 3) {
			return labels.slice(labels.length - 3);
		}
		return labels;
	}, [dates, cols]);

	return (
		<div className="space-y-1">
			{/* Grid: cols x 7 rows, spaced evenly */}
			<div className="flex gap-[8px]">
				{grid.map((col, colIdx) => (
					<div key={colIdx} className="flex flex-col gap-[8px] items-center">
						{col.map((cell, rowIdx) => (
							<button
								key={rowIdx}
								type="button"
								title={cell.tooltip}
								onClick={onSelectDate ? () => onSelectDate(cell.date) : undefined}
								className={`w-[17px] h-[17px] rounded-[3px] ${DOT_COLORS[cell.level]} ${onSelectDate ? 'cursor-pointer' : 'cursor-default'} transition-colors duration-150 hover:ring-1 hover:ring-ring hover:ring-offset-[0.5px]`}
							/>
						))}
					</div>
				))}
			</div>

			{/* Month labels at bottom, aligned to grid columns */}
			<div className="flex gap-[8px]">
				{Array.from({ length: cols }).map((_, col) => {
					const label = monthLabels.find((m) => m.col === col);
					return (
						<div
							key={col}
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
