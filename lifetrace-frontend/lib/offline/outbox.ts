// outbox：离线写操作的持久队列 + 推送前的合并（coalesce）
//
// coalesce 规则：
// - 同一 uid 的连续 update 合并为一条（todo 编辑是 500ms 防抖流，会产生大量 partial update）
// - create 后跟 update → 合并进 create payload
// - create 后跟 delete → 整组丢弃（从未同步过，等于从未存在）
// - habit.record_set 按 (uid, date) 合并，只留最后状态
import { getAllOutboxOps, type OutboxOp, putOutboxOp } from "./db";
import { newOpId } from "./ids";
import { useSyncStatus } from "./status";

function entityPrefix(kind: OutboxOp["kind"]): string {
	return kind.split(".")[0];
}

export async function enqueueOp(
	op: Omit<OutboxOp, "opId" | "queuedAt" | "attempts">,
): Promise<OutboxOp> {
	const full: OutboxOp = {
		...op,
		opId: newOpId(),
		queuedAt: new Date().toISOString(),
		attempts: 0,
	};
	await putOutboxOp(full);
	await refreshPendingCount();
	void requestBackgroundSync();
	return full;
}

async function requestBackgroundSync(): Promise<void> {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
	try {
		const registration = await navigator.serviceWorker.ready;
		const sync = (registration as ServiceWorkerRegistration & {
			sync?: { register(tag: string): Promise<void> };
		}).sync;
		await sync?.register("lifetrace-sync");
	} catch {
		// Background Sync is best-effort; online/visibility listeners remain the fallback.
	}
}

export async function pendingOpsForEntity(
	entity: "todo" | "journal" | "habit",
): Promise<OutboxOp[]> {
	const ops = await getAllOutboxOps();
	return ops.filter((op) => entityPrefix(op.kind) === entity);
}

export async function refreshPendingCount(): Promise<number> {
	const ops = await getAllOutboxOps();
	useSyncStatus.getState().setPendingCount(ops.length);
	return ops.length;
}

interface CoalesceKey {
	key: string;
	uid: string;
}

function coalesceKeyOf(op: OutboxOp): CoalesceKey {
	if (op.kind === "habit.record_set") {
		const date = (op.payload as { date?: string })?.date ?? "";
		return { key: `${op.kind}:${op.uid}:${date}`, uid: op.uid };
	}
	return { key: `${op.kind}:${op.uid}`, uid: op.uid };
}

/**
 * 合并队列中的操作。返回仍需推送的操作（保持依赖顺序：按原队列顺序输出）。
 */
export function coalesceOps(ops: OutboxOp[]): OutboxOp[] {
	// 按 uid 分组，保留每组操作序列
	const byUid = new Map<string, OutboxOp[]>();
	const order: string[] = [];
	for (const op of ops) {
		if (!byUid.has(op.uid)) {
			byUid.set(op.uid, []);
			order.push(op.uid);
		}
		byUid.get(op.uid)?.push(op);
	}

	const result: OutboxOp[] = [];
	for (const uid of order) {
		const group = byUid.get(uid);
		if (group) result.push(...coalesceGroup(group));
	}
	return result;
}

function coalesceGroup(group: OutboxOp[]): OutboxOp[] {
	if (group.length === 0) return [];

	const first = group[0];
	const kindBase = first.kind.split(".")[0];
	const firstAction = first.kind.split(".")[1];

	// 习惯打卡：逐条合并为最后状态
	if (first.kind === "habit.record_set") {
		const merged = new Map<string, OutboxOp>();
		for (const op of group) {
			const { key } = coalesceKeyOf(op);
			const prev = merged.get(key);
			merged.set(key, prev ? { ...op, dependsOn: prev.dependsOn } : op);
		}
		return [...merged.values()];
	}

	// create 起头的组：合并后续 update；遇 delete 整组丢弃；habit.record_set 作为兄弟操作保留
	if (firstAction === "create") {
		const payload = { ...(first.payload as Record<string, unknown>) };
		const recordSets = new Map<string, OutboxOp>();
		let deleted = false;
		for (const op of group.slice(1)) {
			if (op.kind === `${kindBase}.delete`) {
				deleted = true;
				break;
			}
			if (op.kind === `${kindBase}.update`) {
				Object.assign(payload, op.payload as Record<string, unknown>);
			}
			if (op.kind === "habit.record_set") {
				const { key } = coalesceKeyOf(op);
				recordSets.set(key, op);
			}
		}
		if (deleted) return [];
		return [{ ...first, payload }, ...recordSets.values()];
	}

	// update/delete 起头的组：合并 update，遇 delete 只留 delete
	const payload = { ...(first.payload as Record<string, unknown>) };
	let lastUpdate: OutboxOp | null = first;
	for (const op of group.slice(1)) {
		if (op.kind === `${kindBase}.delete`) {
			return [op]; // 后续（若有）不可能存在——delete 是终态
		}
		if (op.kind === `${kindBase}.update`) {
			Object.assign(payload, op.payload as Record<string, unknown>);
			lastUpdate = op;
		}
	}
	if (!lastUpdate) return [];
	// baseUpdatedAt 取首条（整个离线编辑会话所基于的版本），queuedAt 取末条
	return [
		{
			...lastUpdate,
			baseUpdatedAt: first.baseUpdatedAt,
			payload,
		},
	];
}
