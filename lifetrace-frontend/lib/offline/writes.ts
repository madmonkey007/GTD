// 离线写入：mutation 失败（断网）或 navigator.onLine === false 时的本地落盘路径
// 本地改镜像 + react-query 缓存，操作入 outbox，联网后由 engine 推送

import { isOfflineError } from "@/lib/api/fetcher";
import { queryKeys } from "@/lib/query/keys";
import { getQueryClient } from "@/lib/query/provider";
import {
	deleteMirrorEntity,
	getMirrorEntity,
	listMirrorEntities,
	putMirrorEntity,
} from "./db";
import { newUid } from "./ids";
import { findUidById } from "./mirror";
import { enqueueOp } from "./outbox";

interface TodoListResponse {
	total: number;
	todos: Record<string, unknown>[];
}

// 临时负数 id：取时间低位作起点，跨页面重载不冲突；服务器 id 恒为正
let tempSeq = -(Date.now() % 1_000_000_000);
export function nextTempId(): number {
	return tempSeq--;
}
export function isTempId(id: number | string): boolean {
	return typeof id === "number" ? id < 0 : id.startsWith("tmp-");
}

function nowIso(): string {
	return new Date().toISOString();
}

export { isOfflineError };

/** 当前是否离线（用于跳过注定失败的网络请求） */
export function isOffline(): boolean {
	return typeof navigator !== "undefined" && !navigator.onLine;
}

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------

function setTodosCache(updater: (todos: Record<string, unknown>[]) => Record<string, unknown>[]) {
	const qc = getQueryClient();
	const current = qc.getQueryData<TodoListResponse>(queryKeys.todos.list());
	const todos = current?.todos ?? [];
	qc.setQueryData(queryKeys.todos.list(), {
		todos: updater(todos as Record<string, unknown>[]),
		total: current?.total ?? todos.length,
	});
}

/** 解析 parentTodoId：临时 id → dependsOn + null；服务器 id → 原样保留 */
async function resolveParentRef(
	parentTodoId: number | null | undefined,
): Promise<{ parentTodoId: number | null; dependsOn?: string[] }> {
	if (parentTodoId === null || parentTodoId === undefined) {
		return { parentTodoId: null };
	}
	if (isTempId(parentTodoId)) {
		const parentUid = await findUidById("todo", parentTodoId);
		return parentUid
			? { parentTodoId: null, dependsOn: [parentUid] }
			: { parentTodoId: null };
	}
	return { parentTodoId };
}

export async function offlineCreateTodo(
	payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const uid = newUid();
	const id = nextTempId();
	const { parentTodoId, dependsOn } = await resolveParentRef(
		payload.parentTodoId as number | null | undefined,
	);

	const row: Record<string, unknown> = {
		id,
		uid,
		name: (payload.name as string) ?? "",
		summary: payload.summary ?? undefined,
		description: payload.description ?? undefined,
		userNotes: payload.userNotes ?? undefined,
		status: (payload.status as string) ?? "active",
		priority: (payload.priority as string) ?? "none",
		order: (payload.order as number) ?? 0,
		tags: (payload.tags as string[]) ?? [],
		attachments: [],
		parentTodoId,
		relatedActivities: [],
		createdAt: nowIso(),
		updatedAt: nowIso(),
		pendingSync: true,
	};
	await putMirrorEntity("todo", row);
	await enqueueOp({
		kind: "todo.create",
		uid,
		dependsOn,
		baseUpdatedAt: null,
		payload: { ...payload, uid, parentTodoId },
	});
	setTodosCache((todos) => [row, ...todos]);
	return row;
}

export async function offlineUpdateTodo(
	id: number,
	input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const uid = await findUidById("todo", id);
	if (!uid) throw new Error("Todo not found in mirror");
	const row = await getMirrorEntity<Record<string, unknown>>("todo", uid);
	if (!row) throw new Error("Todo not found in mirror");

	const baseUpdatedAt = (row.updatedAt as string) ?? null;
	let dependsOn: string[] | undefined;
	if (input.parentTodoId !== undefined) {
		const resolved = await resolveParentRef(
			input.parentTodoId as number | null | undefined,
		);
		input = { ...input, parentTodoId: resolved.parentTodoId };
		dependsOn = resolved.dependsOn;
	}

	const merged: Record<string, unknown> = {
		...row,
		...input,
		updatedAt: nowIso(),
		pendingSync: true,
	};
	await putMirrorEntity("todo", merged);
	await enqueueOp({
		kind: "todo.update",
		uid,
		dependsOn,
		baseUpdatedAt,
		payload: input,
	});
	setTodosCache((todos) => todos.map((t) => (t.id === id ? merged : t)));
	return merged;
}

export async function offlineDeleteTodo(id: number): Promise<number> {
	const topUid = await findUidById("todo", id);
	if (!topUid) return id;

	// 收集子树（镜像里递归），全部从镜像和缓存移除；服务器端 delete 自带递归
	const all = await listMirrorEntities<Record<string, unknown>>("todo");
	const collect = (parentId: number, acc: Record<string, unknown>[]) => {
		for (const t of all) {
			if (t.parentTodoId === parentId) {
				acc.push(t);
				collect(t.id as number, acc);
			}
		}
	};
	const descendants: Record<string, unknown>[] = [];
	collect(id, descendants);
	const subtree = [{ id, uid: topUid }, ...descendants] as Array<{
		id: number;
		uid: string;
	}>;
	const ids = new Set(subtree.map((t) => t.id));

	for (const t of subtree) {
		await deleteMirrorEntity("todo", t.uid);
	}
	await enqueueOp({
		kind: "todo.delete",
		uid: topUid,
		baseUpdatedAt: null,
		payload: {},
	});
	setTodosCache((todos) => todos.filter((t) => !ids.has(t.id as number)));
	return id;
}

/** 在线创建/更新成功后写穿镜像 */
export async function saveTodoToMirror(raw: Record<string, unknown>) {
	const uid = (raw.uid as string) || `srv-${raw.id}`;
	await putMirrorEntity("todo", {
		...raw,
		uid,
		pendingSync: false,
	});
}

// ---------------------------------------------------------------------------
// Journals
// ---------------------------------------------------------------------------

interface JournalListCacheShape {
	total: number;
	journals: Record<string, unknown>[];
}

function updateAllJournalCaches(
	updater: (journals: Record<string, unknown>[]) => Record<string, unknown>[],
) {
	const qc = getQueryClient();
	qc.setQueriesData<JournalListCacheShape>(
		{ queryKey: queryKeys.journals.all },
		(old) => {
			if (!old?.journals) return old;
			return { ...old, journals: updater(old.journals) };
		},
	);
}

export async function offlineCreateJournal(
	payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const uid = newUid();
	const id = nextTempId();
	const now = nowIso();
	const userNotes = (payload.user_notes as string) ?? "";
	const row: Record<string, unknown> = {
		id,
		uid,
		name: (payload.name as string) ?? "",
		userNotes,
		date: (payload.date as string) ?? now,
		contentFormat: (payload.content_format as string) ?? "markdown",
		contentObjective: null,
		contentAi: null,
		mood: (payload.mood as string) ?? null,
		energy: (payload.energy as number) ?? null,
		dayBucketStart: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		origin: (payload.origin as string) ?? "manual",
		tags: [],
		relatedTodoIds: [],
		relatedActivityIds: [],
		relatedNoteIds: [],
		relatedTodos: [],
		pendingSync: true,
	};
	await putMirrorEntity("journal", row);
	await enqueueOp({
		kind: "journal.create",
		uid,
		baseUpdatedAt: null,
		payload: { ...payload, uid },
	});
	updateAllJournalCaches((journals) => [row, ...journals]);
	return row;
}

const JOURNAL_FIELD_MAP: Record<string, string> = {
	name: "name",
	user_notes: "userNotes",
	content_format: "contentFormat",
	content_objective: "contentObjective",
	mood: "mood",
	energy: "energy",
	date: "date",
	day_bucket_start: "dayBucketStart",
};

export async function offlineUpdateJournal(
	id: number,
	input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	// uid 优先从缓存（JournalView 自带 uid），镜像兜底
	let uid: string | null = null;
	const qc = getQueryClient();
	for (const query of qc.getQueriesData<JournalListCacheShape>({
		queryKey: queryKeys.journals.all,
	})) {
		const found = query[1]?.journals?.find((j) => j.id === id);
		if (found?.uid) {
			uid = found.uid as string;
			break;
		}
	}
	uid = uid ?? (await findUidById("journal", id));
	if (!uid) throw new Error("Journal not found");

	const row =
		(await getMirrorEntity<Record<string, unknown>>("journal", uid)) ?? {};
	const baseUpdatedAt = (row.updatedAt as string) ?? null;

	const patch: Record<string, unknown> = {};
	for (const [snakeKey, camelKey] of Object.entries(JOURNAL_FIELD_MAP)) {
		if (input[snakeKey] !== undefined) {
			patch[camelKey] = input[snakeKey];
		}
	}
	if (input.tags !== undefined) {
		// tags 由服务端从正文提取；本地按正文 #tag 提取预览
		const notes = (patch.userNotes as string) ?? row.userNotes ?? "";
		const matches = String(notes).match(/#([^\s#]+)(\s|$)/g);
		const tags = (matches ?? []).map((m) => ({
			id: 0,
			tagName: m.slice(1).trimEnd(),
		}));
		patch.tags = tags;
	}

	const merged: Record<string, unknown> = {
		...row,
		...patch,
		updatedAt: nowIso(),
		pendingSync: true,
	};
	await putMirrorEntity("journal", merged);
	await enqueueOp({
		kind: "journal.update",
		uid,
		baseUpdatedAt,
		payload: input,
	});
	updateAllJournalCaches((journals) =>
		journals.map((j) => (j.id === id ? merged : j)),
	);
	return merged;
}

export async function offlineDeleteJournal(id: number): Promise<void> {
	const uid = await findUidById("journal", id);
	if (uid) {
		await deleteMirrorEntity("journal", uid);
		await enqueueOp({
			kind: "journal.delete",
			uid,
			baseUpdatedAt: null,
			payload: {},
		});
	}
	updateAllJournalCaches((journals) => journals.filter((j) => j.id !== id));
}

export async function saveJournalToMirror(row: Record<string, unknown>) {
	const uid = (row.uid as string) || `srv-${row.id}`;
	await putMirrorEntity("journal", { ...row, uid, pendingSync: false });
}

// ---------------------------------------------------------------------------
// Habits（习惯）— 打卡为 set-state 语义，天然幂等
// ---------------------------------------------------------------------------

interface HabitCacheShape {
	id: string;
	uid: string;
	name: string;
	icon: string;
	frequency: string;
	goal: string;
	startDate: string;
	persistenceDays: number;
	group: string;
	createdAt: string;
}

interface HabitRecordCacheShape {
	habitId: string;
	date: string;
}

export async function offlineCreateHabit(
	body: Record<string, unknown>,
): Promise<HabitCacheShape> {
	const uid = newUid();
	const row: HabitCacheShape = {
		id: `tmp-${nextTempId()}`,
		uid,
		name: (body.name as string) ?? "未命名",
		icon: (body.icon as string) ?? "✅",
		frequency: (body.frequency as string) ?? "daily",
		goal: (body.goal as string) ?? "complete",
		startDate: ((body.start_date as string) ?? nowIso()).slice(0, 10),
		persistenceDays: (body.persistence_days as number) ?? 0,
		group: (body.group as string) ?? "allDay",
		createdAt: nowIso(),
	};
	await putMirrorEntity("habit", { ...row, pendingSync: true });
	await enqueueOp({
		kind: "habit.create",
		uid,
		baseUpdatedAt: null,
		payload: { ...body, uid },
	});
	const qc = getQueryClient();
	qc.setQueryData<HabitCacheShape[]>(queryKeys.habits.list({ limit: 1000 }), (
		old,
	) => (old ? [...old, row] : [row]));
	return row;
}

const HABIT_FIELD_MAP: Record<string, string> = {
	name: "name",
	icon: "icon",
	frequency: "frequency",
	goal: "goal",
	start_date: "startDate",
	persistence_days: "persistenceDays",
	group: "group",
};

export async function offlineUpdateHabit(
	id: string,
	body: Record<string, unknown>,
): Promise<void> {
	const uid = await findUidById("habit", id);
	if (!uid) return;
	const row = await getMirrorEntity<Record<string, unknown>>("habit", uid);
	if (!row) return;
	const patch: Record<string, unknown> = {};
	for (const [snakeKey, field] of Object.entries(HABIT_FIELD_MAP)) {
		if (body[snakeKey] !== undefined) patch[field] = body[snakeKey];
	}
	await putMirrorEntity("habit", {
		...row,
		...patch,
		updatedAt: nowIso(),
		pendingSync: true,
	});
	await enqueueOp({
		kind: "habit.update",
		uid,
		baseUpdatedAt: (row.updatedAt as string) ?? null,
		payload: body,
	});
	const qc = getQueryClient();
	qc.setQueryData<HabitCacheShape[]>(queryKeys.habits.list({ limit: 1000 }), (
		old,
	) =>
		old
			? old.map((h) => (h.id === id ? { ...h, ...patch } : h))
			: old,
	);
}

export async function offlineDeleteHabit(id: string): Promise<void> {
	const uid = await findUidById("habit", id);
	if (!uid) return;
	await deleteMirrorEntity("habit", uid);
	// 连带清理该习惯的打卡镜像
	const records = await listMirrorEntities<{
		habitUid: string;
		date: string;
	}>("habitRecord");
	for (const r of records) {
		if (r.habitUid === uid) {
			await deleteMirrorEntity("habitRecord", [r.habitUid, r.date]);
		}
	}
	await enqueueOp({
		kind: "habit.delete",
		uid,
		baseUpdatedAt: null,
		payload: {},
	});
	const qc = getQueryClient();
	qc.setQueryData<HabitCacheShape[]>(queryKeys.habits.list({ limit: 1000 }), (
		old,
	) => (old ? old.filter((h) => h.id !== id) : old));
	qc.setQueryData<HabitRecordCacheShape[]>(queryKeys.habits.records, (old) =>
		old ? old.filter((r) => r.habitId !== id) : old,
	);
}

/** 打卡：设置目标状态（recorded true=打卡 / false=取消），非 toggle */
export async function offlineSetHabitRecord(
	habitId: string,
	date: string,
	recorded: boolean,
): Promise<void> {
	const uid = await findUidById("habit", habitId);
	if (!uid) return;

	const qc = getQueryClient();
	if (recorded) {
		await putMirrorEntity("habitRecord", { habitUid: uid, habitId, date });
		qc.setQueryData<HabitRecordCacheShape[]>(
			queryKeys.habits.records,
			(old) => (old ? [...old, { habitId, date }] : [{ habitId, date }]),
		);
	} else {
		await deleteMirrorEntity("habitRecord", [uid, date]);
		qc.setQueryData<HabitRecordCacheShape[]>(queryKeys.habits.records, (old) =>
			old ? old.filter((r) => !(r.habitId === habitId && r.date === date)) : old,
		);
	}
	await enqueueOp({
		kind: "habit.record_set",
		uid,
		baseUpdatedAt: null,
		payload: { date, recorded },
	});
}

export async function saveHabitToMirror(row: HabitCacheShape) {
	await putMirrorEntity("habit", { ...row, pendingSync: false });
}
