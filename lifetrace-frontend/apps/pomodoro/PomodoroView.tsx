"use client";

import { useMemo, useState } from "react";
import { Play, RotateCcw, Settings, Square, Minus, Plus } from "lucide-react";
import { StatsChart } from "./components/StatsChart";
import { useTimer } from "./hooks/useTimer";

interface PomodoroConfig {
	workMinutes: number;
	breakMinutes: number;
}

const DEFAULT_CONFIG: PomodoroConfig = {
	workMinutes: 25,
	breakMinutes: 5,
};

const CONFIG_KEY = "pomodoro-config";
const MIN_MINUTES = 1;
const MAX_MINUTES = 120;

function loadConfig(): PomodoroConfig {
	if (typeof window === "undefined") return DEFAULT_CONFIG;
	try {
		const raw = localStorage.getItem(CONFIG_KEY);
		if (!raw) return DEFAULT_CONFIG;
		const parsed = JSON.parse(raw) as Partial<PomodoroConfig>;
		return {
			workMinutes:
				typeof parsed.workMinutes === "number" &&
				parsed.workMinutes >= MIN_MINUTES &&
				parsed.workMinutes <= MAX_MINUTES
					? Math.round(parsed.workMinutes)
					: DEFAULT_CONFIG.workMinutes,
			breakMinutes:
				typeof parsed.breakMinutes === "number" &&
				parsed.breakMinutes >= MIN_MINUTES &&
				parsed.breakMinutes <= MAX_MINUTES
					? Math.round(parsed.breakMinutes)
					: DEFAULT_CONFIG.breakMinutes,
		};
	} catch {
		return DEFAULT_CONFIG;
	}
}

function saveConfig(config: PomodoroConfig) {
	try {
		localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
	} catch {
		// silently fail
	}
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function CircularProgress({
	progress,
	phase,
}: {
	progress: number;
	phase: "work" | "break";
}) {
	const strokeWidth = 6;
	const radius = 162;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference * (1 - progress);
	const color = phase === "work" ? "stroke-primary" : "stroke-emerald-500";

	return (
		<svg width="396" height="396" className="-rotate-90">
			<circle
				cx="198"
				cy="198"
				r={radius}
				fill="none"
				stroke="currentColor"
				strokeWidth={strokeWidth}
				className="text-muted/30"
			/>
			<circle
				cx="198"
				cy="198"
				r={radius}
				fill="none"
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				className={color}
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				style={{ transition: "stroke-dashoffset 0.5s ease" }}
			/>
		</svg>
	);
}

interface PomodoroSession {
	date: string;
	duration: number;
	completedAt: string;
}

function getStats() {
	if (typeof window === "undefined") {
		return { todayCount: 0, todayMinutes: 0, totalCount: 0, totalMinutes: 0 };
	}

	try {
		const raw = localStorage.getItem("pomodoro-sessions");
		const sessions: PomodoroSession[] = raw ? JSON.parse(raw) : [];

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

		let todayCount = 0;
		let todayMinutes = 0;
		let totalCount = sessions.length;
		let totalMinutes = 0;

		for (const s of sessions) {
			totalMinutes += s.duration;
			if (s.date === todayStr) {
				todayCount++;
				todayMinutes += s.duration;
			}
		}

		return { todayCount, todayMinutes, totalCount, totalMinutes };
	} catch {
		return { todayCount: 0, todayMinutes: 0, totalCount: 0, totalMinutes: 0 };
	}
}

function saveSession(workMinutes: number) {
	if (typeof window === "undefined") return;
	try {
		const raw = localStorage.getItem("pomodoro-sessions");
		const sessions: PomodoroSession[] = raw ? JSON.parse(raw) : [];
		const now = new Date();
		const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		sessions.push({
			date: dateStr,
			duration: workMinutes,
			completedAt: now.toISOString(),
		});
		localStorage.setItem("pomodoro-sessions", JSON.stringify(sessions));
	} catch {
		// silently fail
	}
}

export function PomodoroView() {
	const [config, setConfig] = useState<PomodoroConfig>(loadConfig);
	const [showSettings, setShowSettings] = useState(false);
	const [sessionCounter, setSessionCounter] = useState(0);
	const timer = useTimer({
		work: config.workMinutes * 60,
		break: config.breakMinutes * 60,
	}, () => {
		saveSession(config.workMinutes);
		setSessionCounter((c) => c + 1);
	});
	const stats = useMemo(() => getStats(), [sessionCounter]);

	const updateConfig = (patch: Partial<PomodoroConfig>) => {
		const next = { ...config, ...patch };
		setConfig(next);
		saveConfig(next);
	};

	return (
		<div className="flex h-full">
			{/* Left: Timer */}
			<div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
				{/* Phase label */}
				<span
					className={`text-sm font-medium tracking-wider ${
						timer.phase === "work" ? "text-primary" : "text-emerald-500"
					}`}
				>
					{timer.phase === "work" ? "专注时间" : "休息时间"}
				</span>

				{/* Circular progress */}
				<div className="relative flex items-center justify-center">
					<CircularProgress progress={timer.progress} phase={timer.phase} />
					<div className="absolute flex flex-col items-center">
						<span className="text-5xl font-light tracking-tight tabular-nums">
							{formatTime(timer.timeLeft)}
						</span>
					</div>
				</div>

				{/* Controls */}
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={timer.toggle}
						className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95"
					>
						{timer.isRunning ? (
							<Square className="h-6 w-6 fill-current" />
						) : (
							<Play className="ml-0.5 h-6 w-6" />
						)}
					</button>
					<button
						type="button"
						onClick={timer.reset}
						className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/30"
					>
						<RotateCcw className="h-5 w-5" />
					</button>
					<button
						type="button"
						onClick={() => setShowSettings(!showSettings)}
						className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
							showSettings
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-muted/30"
						}`}
					>
						<Settings className="h-5 w-5" />
					</button>
				</div>

				{/* Settings panel */}
				{showSettings && (
					<div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/10 p-4">
						<DurationControl
							label="工作时长"
							value={config.workMinutes}
							onChange={(v) => updateConfig({ workMinutes: v })}
						/>
						<DurationControl
							label="休息时长"
							value={config.breakMinutes}
							onChange={(v) => updateConfig({ breakMinutes: v })}
						/>
					</div>
				)}
			</div>

			{/* Right: Stats */}
			<div className="flex w-80 flex-col gap-4 border-l border-border/40 p-5">
				<h3 className="text-sm font-semibold">今日概览</h3>

				<div className="grid grid-cols-2 gap-2">
					<StatCard label="今日番茄" value={stats.todayCount} unit="个" />
					<StatCard
						label="专注时长"
						value={stats.todayMinutes}
						unit="分钟"
					/>
					<StatCard label="总番茄数" value={stats.totalCount} unit="个" />
					<StatCard
						label="总时长"
						value={stats.totalMinutes}
						unit="分钟"
					/>
				</div>

				<div className="mt-2">
					<h4 className="mb-2 text-xs font-medium text-muted-foreground">
						专注趋势
					</h4>
					<StatsChart />
				</div>
			</div>
		</div>
	);
}

function DurationControl({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (v: number) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-sm text-muted-foreground">{label}</span>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => onChange(Math.max(MIN_MINUTES, value - 1))}
					disabled={value <= MIN_MINUTES}
					className="flex h-7 w-7 items-center justify-center rounded-md border border-border/40 text-muted-foreground transition-colors hover:bg-muted/30 disabled:opacity-30"
				>
					<Minus className="h-3 w-3" />
				</button>
				<span className="w-8 text-center text-sm tabular-nums font-medium">
					{value}
				</span>
				<button
					type="button"
					onClick={() => onChange(Math.min(MAX_MINUTES, value + 1))}
					disabled={value >= MAX_MINUTES}
					className="flex h-7 w-7 items-center justify-center rounded-md border border-border/40 text-muted-foreground transition-colors hover:bg-muted/30 disabled:opacity-30"
				>
					<Plus className="h-3 w-3" />
				</button>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	unit,
}: {
	label: string;
	value: number;
	unit: string;
}) {
	return (
		<div className="rounded-lg border border-border/40 bg-muted/10 p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-lg font-semibold tabular-nums">
				{value}
				<span className="ml-0.5 text-xs font-normal text-muted-foreground">
					{unit}
				</span>
			</p>
		</div>
	);
}
