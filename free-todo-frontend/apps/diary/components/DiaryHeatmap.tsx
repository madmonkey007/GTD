"use client";

import { useMemo } from "react";
import { formatDateInput } from "@/apps/diary/journal-utils";

interface DiaryHeatmapProps {
	dates: Date[];
	dailyCounts: Map<string, number>;
	onSelectDate?: (date: Date) => void;
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

export function DiaryHeatmap({ dates, dailyCounts, onSelectDate }: DiaryHeatmapProps) {
	const grid = useMemo(() => {
		const cols = 11;
		const rows = 7;
		const cells: { date: Date; level: number; tooltip: string }[][] = [];

		for (let col = 0; col < cols; col++) {
			const column: { date: Date; level: number; tooltip: string }[] = [];
			for (let row = 0; row < rows; row++) {
				const index = col * rows + row;
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
	}, [dates, dailyCounts]);

	const monthLabels = useMemo(() => {
		const labels: { label: string; col: number }[] = [];
		let lastMonth = -1;
		for (let col = 0; col < 11; col++) {
			const index = col * 7;
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
	}, [dates]);

	return (
		<div className="space-y-1">
			{/* Grid: 11 cols x 7 rows, spaced evenly */}
			<div className="flex justify-between">
				{grid.map((col, colIdx) => (
					<div key={colIdx} className="flex flex-col gap-[5px] items-center">
						{col.map((cell, rowIdx) => (
							<button
								key={rowIdx}
								type="button"
								title={cell.tooltip}
								onClick={onSelectDate ? () => onSelectDate(cell.date) : undefined}
								className={`w-3 h-3 rounded-full ${DOT_COLORS[cell.level]} ${onSelectDate ? 'cursor-pointer' : 'cursor-default'} transition-colors duration-150 hover:ring-1 hover:ring-ring hover:ring-offset-[0.5px]`}
							/>
						))}
					</div>
				))}
			</div>

			{/* Month labels at bottom, evenly spread */}
			<div className="flex justify-between">
				{Array.from({ length: 11 }).map((_, col) => {
					const label = monthLabels.find((m) => m.col === col);
					return (
						<div
							key={col}
							className="text-[9px] text-muted-foreground/50 leading-none text-center whitespace-nowrap"
							style={{ width: 12 }}
						>
							{label ? label.label : ""}
						</div>
					);
				})}
			</div>
		</div>
	);
}
