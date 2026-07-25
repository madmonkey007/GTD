"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

const API_BASE =
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

// 前端习惯类型（沿用 apps/habits 里的 Habit 接口形状，id 为 string 以保持向后兼容）
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

export interface HabitRecord {
	habitId: string;
	date: string; // YYYY-MM-DD
}

interface ServerHabit {
	id: number;
	uid: string;
	name: string;
	icon: string;
	frequency: string;
	goal: string;
	start_date: string | null;
	persistence_days: number;
	group: string;
	created_at: string;
	updated_at: string;
}

interface ServerRecord {
	id: number;
	habit_id: number;
	record_date: string;
	created_at: string;
}

function toDateKey(value: string | null): string {
	if (!value) return new Date().toISOString().slice(0, 10);
	return value.length >= 10 ? value.slice(0, 10) : value;
}

function mapHabit(h: ServerHabit): Habit {
	return {
		id: String(h.id),
		name: h.name,
		icon: h.icon || "✅",
		frequency: (h.frequency as Habit["frequency"]) || "daily",
		goal: (h.goal as Habit["goal"]) || "complete",
		startDate: toDateKey(h.start_date),
		persistenceDays: h.persistence_days ?? 0,
		group: (h.group as Habit["group"]) || "allDay",
		createdAt: h.created_at,
	};
}

function mapRecord(r: ServerRecord): HabitRecord {
	return {
		habitId: String(r.habit_id),
		date: toDateKey(r.record_date),
	};
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
		...init,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status} ${res.statusText} ${text}`);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

// ---- 一次性迁移：把旧 localStorage 习惯数据搬到服务器 ----

const MIGRATE_FLAG = "habits-migrated";
const OLD_HABITS_KEY = "habits";
const OLD_RECORDS_KEY = "habit-records";
let migrationInFlight: Promise<boolean> | null = null;

interface OldHabit {
	id: string;
	name: string;
	icon?: string;
	frequency?: string;
	goal?: string;
	startDate?: string;
	persistenceDays?: number;
	group?: string;
}
interface OldRecord {
	habitId: string;
	date: string;
}

/**
 * 若本地 localStorage 存在旧习惯数据且尚未迁移，则上传到服务器并清理本地。
 * 返回是否执行了迁移（用于触发列表刷新）。多次调用安全（幂等 + 并发保护）。
 */
export async function migrateLocalHabitsIfNeeded(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	if (localStorage.getItem(MIGRATE_FLAG)) return false;
	if (migrationInFlight) return migrationInFlight;

	migrationInFlight = (async () => {
		try {
			const rawHabits = localStorage.getItem(OLD_HABITS_KEY);
			const rawRecords = localStorage.getItem(OLD_RECORDS_KEY);
			const oldHabits: OldHabit[] = rawHabits ? JSON.parse(rawHabits) : [];
			const oldRecords: OldRecord[] = rawRecords ? JSON.parse(rawRecords) : [];

			if (!oldHabits.length) {
				localStorage.setItem(MIGRATE_FLAG, "1");
				return false;
			}

			// 仅在服务器为空时迁移，避免重复灌入
			const existing = await fetchHabits();
			if (existing.length > 0) {
				localStorage.setItem(MIGRATE_FLAG, "1");
				localStorage.removeItem(OLD_HABITS_KEY);
				localStorage.removeItem(OLD_RECORDS_KEY);
				return false;
			}

			const idMap = new Map<string, string>(); // 旧 id -> 新 id
			for (const h of oldHabits) {
				const created = await http<ServerHabit>("/api/habits", {
					method: "POST",
					body: JSON.stringify({
						name: h.name || "未命名",
						icon: h.icon ?? "✅",
						frequency: h.frequency ?? "daily",
						goal: h.goal ?? "complete",
						start_date: h.startDate ? `${h.startDate}T00:00:00` : null,
						persistence_days: h.persistenceDays ?? 0,
						group: h.group ?? "allDay",
					}),
				});
				idMap.set(h.id, String(created.id));
			}

			for (const r of oldRecords) {
				const newId = idMap.get(r.habitId);
				if (!newId) continue;
				try {
					await http(`/api/habits/${newId}/records`, {
						method: "POST",
						body: JSON.stringify({ date: `${r.date}T00:00:00` }),
					});
				} catch {
					// 单条记录失败不阻断整体迁移
				}
			}

			localStorage.setItem(MIGRATE_FLAG, "1");
			localStorage.removeItem(OLD_HABITS_KEY);
			localStorage.removeItem(OLD_RECORDS_KEY);
			return true;
		} catch (e) {
			console.error("[habits] 本地迁移失败", e);
			return false;
		} finally {
			migrationInFlight = null;
		}
	})();
	return migrationInFlight;
}

// ---- fetchers ----

export async function fetchHabits(): Promise<Habit[]> {
	const data = await http<{ total: number; habits: ServerHabit[] }>(
		"/api/habits?limit=1000",
	);
	return data.habits.map(mapHabit);
}

export async function fetchAllHabitRecords(): Promise<HabitRecord[]> {
	const data = await http<{ records: ServerRecord[] }>(
		"/api/habits/records/all",
	);
	return data.records.map(mapRecord);
}

export interface HabitInput {
	name: string;
	icon?: string;
	frequency?: Habit["frequency"];
	goal?: Habit["goal"];
	startDate?: string;
	persistenceDays?: number;
	group?: Habit["group"];
}

// ---- hooks ----

export function useHabitsQuery() {
	return useQuery({
		queryKey: queryKeys.habits.list({ limit: 1000 }),
		queryFn: fetchHabits,
		staleTime: 30 * 1000,
	});
}

export function useHabitRecordsQuery() {
	return useQuery({
		queryKey: queryKeys.habits.records,
		queryFn: fetchAllHabitRecords,
		staleTime: 30 * 1000,
	});
}

export function useHabitMutations() {
	const queryClient = useQueryClient();
	const invalidate = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.habits.all }),
		]);

	const createMutation = useMutation({
		mutationFn: async (input: HabitInput) => {
			const body = {
				name: input.name,
				icon: input.icon ?? "✅",
				frequency: input.frequency ?? "daily",
				goal: input.goal ?? "complete",
				start_date: input.startDate ? `${input.startDate}T00:00:00` : null,
				persistence_days: input.persistenceDays ?? 0,
				group: input.group ?? "allDay",
			};
			return http<ServerHabit>("/api/habits", {
				method: "POST",
				body: JSON.stringify(body),
			});
		},
		onSuccess: () => invalidate(),
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, input }: { id: string; input: Partial<HabitInput> }) => {
			const body: Record<string, unknown> = {};
			if (input.name !== undefined) body.name = input.name;
			if (input.icon !== undefined) body.icon = input.icon;
			if (input.frequency !== undefined) body.frequency = input.frequency;
			if (input.goal !== undefined) body.goal = input.goal;
			if (input.startDate !== undefined)
				body.start_date = `${input.startDate}T00:00:00`;
			if (input.persistenceDays !== undefined)
				body.persistence_days = input.persistenceDays;
			if (input.group !== undefined) body.group = input.group;
			return http<ServerHabit>(`/api/habits/${id}`, {
				method: "PUT",
				body: JSON.stringify(body),
			});
		},
		onSuccess: () => invalidate(),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) =>
			http<void>(`/api/habits/${id}`, { method: "DELETE" }),
		onSuccess: () => invalidate(),
	});

	const toggleMutation = useMutation({
		mutationFn: async ({ habitId, date }: { habitId: string; date?: string }) => {
			const d = date ?? new Date().toISOString().slice(0, 10);
			return http<{ recorded: boolean }>(
				`/api/habits/${habitId}/records`,
				{ method: "POST", body: JSON.stringify({ date: `${d}T00:00:00` }) },
			);
		},
		onSuccess: () => invalidate(),
	});

	return {
		createHabit: (input: HabitInput) => createMutation.mutateAsync(input),
		updateHabit: (id: string, input: Partial<HabitInput>) =>
			updateMutation.mutateAsync({ id, input }),
		deleteHabit: (id: string) => deleteMutation.mutateAsync(id),
		toggleHabitRecord: (habitId: string, date?: string) =>
			toggleMutation.mutateAsync({ habitId, date }),
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
	};
}
