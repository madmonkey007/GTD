import { authHeaders, useAuthStore } from "@/lib/auth/session";
import { queryKeys } from "@/lib/query/keys";
import { getQueryClient } from "@/lib/query/provider";
import {
	deleteMirrorEntity,
	deleteOutboxOps,
	getAllOutboxOps,
	getMeta,
	getMirrorEntity,
	type MirrorStore,
	type OutboxOp,
	putMirrorEntity,
	putOutboxOp,
	setMeta,
} from "./db";
import { newUid } from "./ids";
import { coalesceOps, refreshPendingCount } from "./outbox";
import { useSyncStatus } from "./status";

const CLIENT_ID_KEY = "sync.clientId";
const CURSOR_KEY = "sync.cursor";
let activeSync: Promise<void> | null = null;

type EntityType = "todo" | "journal" | "habit" | "habit_record";

interface PushResult {
	opId: string;
	status: "applied" | "duplicate" | "conflict" | "error";
	entityType: EntityType;
	uid: string;
	serverId?: number | null;
	entity?: Record<string, unknown> | null;
	error?: string | null;
}

interface PullResponse {
	todos: Record<string, unknown>[];
	journals: Record<string, unknown>[];
	habits: Record<string, unknown>[];
	habitRecords: Record<string, unknown>[];
	tombstones: Array<{ entityType: EntityType; uid: string }>;
	serverTime: string;
}

function camelKey(key: string): string {
	return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function camelize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(camelize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [camelKey(key), camelize(item)]),
		);
	}
	return value;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: authHeaders(init?.headers),
	});
	if (!response.ok) {
		if (response.status === 401) useAuthStore.getState().clearSession();
		throw new Error(`Sync request failed (${response.status})`);
	}
	return camelize(await response.json()) as T;
}

function sortByDependencies(ops: OutboxOp[]): OutboxOp[] {
	const pending = [...ops];
	const sorted: OutboxOp[] = [];
	const resolved = new Set<string>();
	while (pending.length) {
		const index = pending.findIndex((op) =>
			(op.dependsOn ?? []).every((uid) => resolved.has(uid) || !pending.some((p) => p.uid === uid)),
		);
		const [next] = pending.splice(index < 0 ? 0 : index, 1);
		sorted.push(next);
		resolved.add(next.uid);
	}
	return sorted;
}

function storeFor(entityType: EntityType): MirrorStore {
	return entityType === "habit_record" ? "habitRecord" : entityType;
}

async function applyEntity(
	entityType: EntityType,
	uid: string,
	entity: Record<string, unknown>,
	preservePending = false,
) {
	if (entityType === "habit_record") {
		const recorded = Boolean(entity.recorded);
		// pull 行 camelize 后字段是 recordDate（record_date），push 回包用 date
		const date = String(entity.recordDate ?? entity.date ?? "").slice(0, 10);
		if (!date) return;
		if (!recorded) await deleteMirrorEntity("habitRecord", [uid, date]);
		else await putMirrorEntity("habitRecord", { ...entity, habitUid: uid, date });
		return;
	}
	if (preservePending) {
		const local = await getMirrorEntity<Record<string, unknown>>(storeFor(entityType), uid);
		if (local?.pendingSync) return;
	}
	await putMirrorEntity(storeFor(entityType), {
		...entity,
		uid,
		pendingSync: false,
	});
}

async function push(): Promise<void> {
	const original = await getAllOutboxOps();
	const ops = sortByDependencies(coalesceOps(original));
	if (!ops.length) {
		if (original.length) await deleteOutboxOps(original.map((op) => op.opId));
		return;
	}
	let clientId = await getMeta<string>(CLIENT_ID_KEY);
	if (!clientId) {
		clientId = newUid();
		await setMeta(CLIENT_ID_KEY, clientId);
	}
	const response = await requestJson<{ results: PushResult[]; serverTime: string }>(
		"/api/sync/push",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ clientId, ops }),
		},
	);
	const completed: string[] = [];
	for (const result of response.results) {
		if (result.status === "error") {
			const op = original.find((item) => item.opId === result.opId);
			if (op) await putOutboxOp({ ...op, attempts: op.attempts + 1, lastError: result.error ?? "Sync error" });
			continue;
		}
		completed.push(result.opId);
		if (result.entity) await applyEntity(result.entityType, result.uid, result.entity);
		if (result.status === "conflict") {
			useSyncStatus.getState().addConflict({
				uid: result.uid,
				entityType: result.entityType === "habit_record" ? "habit" : result.entityType,
				message: `${result.entityType} 已按冲突规则合并`,
				at: new Date().toISOString(),
			});
		}
	}
	const successfulSent = ops.filter((op) => completed.includes(op.opId));
	const covered = original.filter((candidate) =>
		successfulSent.some((sent) => {
			if (sent.uid !== candidate.uid) return false;
			if (sent.kind !== "habit.record_set") return candidate.kind !== "habit.record_set";
			return candidate.kind === "habit.record_set" &&
				(candidate.payload as { date?: string }).date === (sent.payload as { date?: string }).date;
		}),
	);
	await deleteOutboxOps(covered.map((op) => op.opId));
}

async function pull(): Promise<void> {
	const since = (await getMeta<string>(CURSOR_KEY)) ?? "1970-01-01T00:00:00Z";
	const data = await requestJson<PullResponse>(`/api/sync/pull?since=${encodeURIComponent(since)}`);
	for (const [type, rows] of [
		["todo", data.todos], ["journal", data.journals], ["habit", data.habits],
	] as const) {
		for (const row of rows) await applyEntity(type, String(row.uid), row, true);
	}
	for (const row of data.habitRecords) {
		const uid = String(row.habitUid ?? "");
		if (uid) await applyEntity("habit_record", uid, { ...row, recorded: true });
	}
	for (const tombstone of data.tombstones) {
		if (tombstone.entityType === "habit_record") {
			const split = tombstone.uid.lastIndexOf(":");
			if (split > 0) await deleteMirrorEntity("habitRecord", [tombstone.uid.slice(0, split), tombstone.uid.slice(split + 1)]);
		} else await deleteMirrorEntity(storeFor(tombstone.entityType), tombstone.uid);
	}
	await setMeta(CURSOR_KEY, data.serverTime);
}

async function runSync(): Promise<void> {
	const status = useSyncStatus.getState();
	status.setOnline(navigator.onLine);
	if (!navigator.onLine) return;
	status.setFlushing(true);
	try {
		await push();
		await pull();
		await refreshPendingCount();
		status.setLastSyncAt(new Date().toISOString());
		const qc = getQueryClient();
		await Promise.all([
			qc.invalidateQueries({ queryKey: queryKeys.todos.all }),
			qc.invalidateQueries({ queryKey: queryKeys.journals.all }),
			qc.invalidateQueries({ queryKey: queryKeys.habits.all }),
		]);
	} finally {
		useSyncStatus.getState().setFlushing(false);
	}
}

export function syncNow(): Promise<void> {
	if (!activeSync) activeSync = runSync().finally(() => { activeSync = null; });
	return activeSync;
}
