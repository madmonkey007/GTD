"use client";

import { useCallback, useSyncExternalStore } from "react";

const HABITS_STORAGE_KEY = "habits";
const RECORDS_STORAGE_KEY = "habit-records";

export interface Habit {
	id: string;
	name: string;
	icon: string;
	frequency: "daily" | "weekly" | "monthly";
	goal: "complete" | "participate";
	startDate: string;
	persistenceDays: number;
	group: "morning" | "afternoon" | "evening" | "allDay";
	createdAt: string;
}

const DEFAULT_ICON = "✅";

const DEFAULT_HABIT_ICONS = [
	"📚", "🏃", "🧘", "💪", "🎯",
	"✍️", "🎨", "🎵", "🌱", "💧",
	"🥗", "☕", "💊", "🧠", "📝",
	"📖", "🗣️", "🤝", "🏠", "🌅",
	"🌙", "🧹", "💰", "🎓", "🧩",
	"🎮", "📷", "🌍", "🧭", "🔥",
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function migrateHabit(habit: unknown): Habit {
	const id = isRecord(habit) && typeof habit.id === "string" ? habit.id : generateId();
	const name = isRecord(habit) && typeof habit.name === "string" ? habit.name : "";
	return {
		id,
		name,
		icon: isRecord(habit) && typeof habit.icon === "string" ? habit.icon : DEFAULT_ICON,
		frequency: isRecord(habit) && typeof habit.frequency === "string" ? (habit.frequency as Habit["frequency"]) : "daily",
		goal: isRecord(habit) && typeof habit.goal === "string" ? (habit.goal as Habit["goal"]) : "complete",
		startDate: isRecord(habit) && typeof habit.startDate === "string" ? habit.startDate : new Date().toISOString().slice(0, 10),
		persistenceDays: isRecord(habit) && typeof habit.persistenceDays === "number" ? habit.persistenceDays : 0,
		group: isRecord(habit) && typeof habit.group === "string" ? (habit.group as Habit["group"]) : "allDay",
		createdAt: isRecord(habit) && typeof habit.createdAt === "string" ? habit.createdAt : new Date().toISOString(),
	};
}

export interface HabitRecord {
	habitId: string;
	date: string; // YYYY-MM-DD
}

function generateId(): string {
	return "hbt_" + Math.random().toString(36).slice(2, 9);
}

function toDateKey(date: Date): string {
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, "0");
	const d = `${date.getDate()}`.padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function getTodayKey(): string {
	return toDateKey(new Date());
}

// --- Habits store ---
function getHabits(): Habit[] {
	try {
		const raw = localStorage.getItem(HABITS_STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return parsed.map(migrateHabit);
			}
		}
	} catch {
		// ignore
	}
	return [];
}

function setHabits(habits: Habit[]): void {
	localStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
}

// --- Records store ---
function getRecords(): HabitRecord[] {
	try {
		const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
		if (raw) return JSON.parse(raw) as HabitRecord[];
	} catch {
		// ignore
	}
	return [];
}

function setRecords(records: HabitRecord[]): void {
	localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
}

// --- Snapshot caching for useSyncExternalStore ---
let cachedHabits: Habit[] = [];
let cachedRecords: HabitRecord[] = [];

function rebuildHabitsSnapshot(): void {
	cachedHabits = getHabits();
}

function rebuildRecordsSnapshot(): void {
	cachedRecords = getRecords();
}

function getHabitsSnapshot(): Habit[] {
	return cachedHabits;
}

function getRecordsSnapshot(): HabitRecord[] {
	return cachedRecords;
}

rebuildHabitsSnapshot();
rebuildRecordsSnapshot();

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

function notify(): void {
	rebuildHabitsSnapshot();
	rebuildRecordsSnapshot();
	for (const cb of listeners) cb();
}

export function useHabits() {
	const habits = useSyncExternalStore(subscribe, getHabitsSnapshot);
	const records = useSyncExternalStore(subscribe, getRecordsSnapshot);

	const addHabit = useCallback((name: string, extra?: {
		icon?: string;
		frequency?: Habit["frequency"];
		goal?: Habit["goal"];
		startDate?: string;
		persistenceDays?: number;
		group?: Habit["group"];
	}) => {
		const habit: Habit = {
			id: generateId(),
			name,
			icon: extra?.icon ?? DEFAULT_ICON,
			frequency: extra?.frequency ?? "daily",
			goal: extra?.goal ?? "complete",
			startDate: extra?.startDate ?? new Date().toISOString().slice(0, 10),
			persistenceDays: extra?.persistenceDays ?? 0,
			group: extra?.group ?? "allDay",
			createdAt: new Date().toISOString(),
		};
		const list = getHabits();
		list.unshift(habit);
		setHabits(list);
		notify();
	}, []);

	const removeHabit = useCallback((id: string) => {
		const list = getHabits();
		setHabits(list.filter(h => h.id !== id));
		// NOT removing records here — they stay until trash is emptied
		notify();
	}, []);

	const renameHabit = useCallback((id: string, name: string) => {
		const list = getHabits().map((h) => (h.id === id ? { ...h, name } : h));
		setHabits(list);
		notify();
	}, []);

	// --- Check-in / Check-out ---
	const toggleRecord = useCallback((habitId: string, date?: string) => {
		const dateKey = date ?? getTodayKey();
		const recs = getRecords();
		const existing = recs.find(
			(r) => r.habitId === habitId && r.date === dateKey,
		);
		if (existing) {
			setRecords(recs.filter((r) => r !== existing));
		} else {
			setRecords([...recs, { habitId, date: dateKey }]);
		}
		notify();
	}, []);

	const isChecked = useCallback(
		(habitId: string, date?: string): boolean => {
			const dateKey = date ?? getTodayKey();
			return cachedRecords.some(
				(r) => r.habitId === habitId && r.date === dateKey,
			);
		},
		[],
	);

	return {
		habits: habits as Habit[],
		records: records as HabitRecord[],
		addHabit,
		removeHabit,
		renameHabit,
		toggleRecord,
		isChecked,
	};
}

export { DEFAULT_HABIT_ICONS, toDateKey };

export function countMonthlyRecords(
	records: HabitRecord[],
	habitId: string,
	year: number,
	month: number,
): number {
	const monthStr = `${year}-${`${month}`.padStart(2, "0")}`;
	const seen = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId && r.date.startsWith(monthStr)) {
			seen.add(r.date);
		}
	}
	return seen.size;
}

export function countTotalRecords(
	records: HabitRecord[],
	habitId: string,
): number {
	const seen = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId) seen.add(r.date);
	}
	return seen.size;
}

export function countAllRecords(
	records: HabitRecord[],
	habitId: string,
): number {
	return records.filter((r) => r.habitId === habitId).length;
}

export function countRecentRecords(
	records: HabitRecord[],
	habitId: string,
	days: number,
): number {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days + 1);
	const cutoffKey = toDateKey(cutoff);
	const seen = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId && r.date >= cutoffKey) {
			seen.add(r.date);
		}
	}
	return seen.size;
}

export function calcMonthlyRate(
	records: HabitRecord[],
	habitId: string,
	year: number,
	month: number,
): number {
	const checked = countMonthlyRecords(records, habitId, year, month);
	const today = new Date();
	const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
	const totalDays = isCurrentMonth
		? today.getDate()
		: new Date(year, month, 0).getDate();
	return totalDays > 0 ? Math.round((checked / totalDays) * 100) : 0;
}

export function calcStreak(
	records: HabitRecord[],
	habitId: string,
): number {
	const checkedSet = new Set<string>();
	for (const r of records) {
		if (r.habitId === habitId) checkedSet.add(r.date);
	}

	let streak = 0;
	const today = new Date();
	for (let i = 0; i < 365; i++) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const key = toDateKey(d);
		if (checkedSet.has(key)) {
			streak++;
		} else {
			break;
		}
	}
	return streak;
}
