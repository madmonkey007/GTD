"use client";

import { useMemo, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

type RangeKey = "today" | "7d" | "30d" | "1y";

const RANGES: { key: RangeKey; label: string }[] = [
	{ key: "today", label: "今天" },
	{ key: "7d", label: "7天" },
	{ key: "30d", label: "30天" },
	{ key: "1y", label: "1年" },
];

interface PomodoroSession {
	date: string; // YYYY-MM-DD
	duration: number; // minutes
	completedAt: string;
}

function getSessions(): PomodoroSession[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem("pomodoro-sessions");
		return raw ? (JSON.parse(raw) as PomodoroSession[]) : [];
	} catch {
		return [];
	}
}

export function StatsChart() {
	const [range, setRange] = useState<RangeKey>("7d");

	const chartData = useMemo(() => {
		const sessions = getSessions();
		if (sessions.length === 0) return [];

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		let startDate: Date;
		const dateFormat = (d: Date): string =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

		switch (range) {
			case "today":
				startDate = today;
				break;
			case "7d": {
				const d = new Date(today);
				d.setDate(d.getDate() - 6);
				startDate = d;
				break;
			}
			case "30d": {
				const d = new Date(today);
				d.setDate(d.getDate() - 29);
				startDate = d;
				break;
			}
			case "1y": {
				const d = new Date(today);
				d.setFullYear(d.getFullYear() - 1);
				startDate = d;
				break;
			}
		}

		// Aggregate sessions by date
		const aggregated = new Map<string, number>();
		for (const session of sessions) {
			const sessionDate = new Date(session.completedAt);
			if (sessionDate >= startDate && sessionDate <= now) {
				const key = dateFormat(sessionDate);
				aggregated.set(key, (aggregated.get(key) ?? 0) + session.duration);
			}
		}

		// Fill in missing dates with 0
		const data: { date: string; minutes: number }[] = [];
		const cursor = new Date(startDate);
		while (cursor <= today) {
			const key = dateFormat(cursor);
			const label =
				range === "today"
					? `${cursor.getHours()}:00`
					: `${cursor.getMonth() + 1}/${cursor.getDate()}`;
			data.push({
				date: label,
				minutes: aggregated.get(key) ?? 0,
			});
			cursor.setDate(cursor.getDate() + 1);
		}

		return data;
	}, [range]);

	return (
		<div>
			<div className="mb-3 flex items-center gap-1">
				{RANGES.map((r) => (
					<button
						key={r.key}
						type="button"
						onClick={() => setRange(r.key)}
						className={`rounded-md px-2 py-1 text-xs transition-colors ${
							range === r.key
								? "bg-primary/10 text-primary font-medium"
								: "text-muted-foreground hover:bg-muted/30"
						}`}
					>
						{r.label}
					</button>
				))}
			</div>
			{chartData.length === 0 || chartData.every((d) => d.minutes === 0) ? (
				<div className="flex h-[160px] items-center justify-center text-xs text-muted-foreground/50">
					暂无数据
				</div>
			) : (
				<div style={{ height: 160 }}>
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.3} />
							<XAxis
								dataKey="date"
								tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
								axisLine={false}
								tickLine={false}
								interval="preserveStartEnd"
							/>
							<YAxis
								tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
								axisLine={false}
								tickLine={false}
								width={24}
							/>
							<Tooltip
								contentStyle={{
									fontSize: 12,
									borderRadius: 8,
									border: "1px solid var(--color-border)",
									background: "var(--color-background)",
								}}
								formatter={(value) => [`${value} 分钟`, "专注时长"]}
							/>
							<Line
								type="monotone"
								dataKey="minutes"
								stroke="var(--color-primary)"
								strokeWidth={2}
								dot={false}
								activeDot={{ r: 4, strokeWidth: 0 }}
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			)}
		</div>
	);
}
