// 离线优先本地存储：IndexedDB 实体镜像 + outbox 操作队列 + meta（同步游标等）
// react-query 仍是内存读层；这里只是断网时的兜底数据源与待同步操作日志
import { type IDBPDatabase, openDB } from "idb";
import { getStoredAuthUser } from "@/lib/auth/session";

export type OutboxOpKind =
	| "todo.create"
	| "todo.update"
	| "todo.delete"
	| "journal.create"
	| "journal.update"
	| "journal.delete"
	| "habit.create"
	| "habit.update"
	| "habit.delete"
	| "habit.record_set";

export interface OutboxOp {
	opId: string;
	kind: OutboxOpKind;
	uid: string;
	// 依赖的其他实体 uid（如子任务依赖父任务），推送时按拓扑序解析
	dependsOn?: string[];
	// 执行此操作时客户端看到的 updated_at，服务端用它判断是否冲突
	baseUpdatedAt: string | null;
	payload: unknown;
	queuedAt: string;
	attempts: number;
	lastError?: string;
}

export type MirrorStore = "todo" | "journal" | "habit" | "habitRecord";

const DB_NAME_PREFIX = "lifetrace-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;
let activeDbName: string | null = null;

function getDbName(): string {
	const user = getStoredAuthUser();
	return user?.id ? `${DB_NAME_PREFIX}-user-${user.id}` : `${DB_NAME_PREFIX}-anonymous`;
}

export function getDb(): Promise<IDBPDatabase> {
	if (typeof indexedDB === "undefined") {
		return Promise.reject(new Error("IndexedDB unavailable"));
	}
	const dbName = getDbName();
	if (!dbPromise || activeDbName !== dbName) {
		activeDbName = dbName;
		dbPromise = openDB(dbName, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains("todo")) {
					db.createObjectStore("todo", { keyPath: "uid" });
				}
				if (!db.objectStoreNames.contains("journal")) {
					db.createObjectStore("journal", { keyPath: "uid" });
				}
				if (!db.objectStoreNames.contains("habit")) {
					db.createObjectStore("habit", { keyPath: "uid" });
				}
				if (!db.objectStoreNames.contains("habitRecord")) {
					db.createObjectStore("habitRecord", {
						keyPath: ["habitUid", "date"],
					});
				}
				if (!db.objectStoreNames.contains("outbox")) {
					const outbox = db.createObjectStore("outbox", { keyPath: "opId" });
					outbox.createIndex("by_uid", "uid");
				}
				if (!db.objectStoreNames.contains("meta")) {
					db.createObjectStore("meta");
				}
			},
		});
	}
	return dbPromise;
}

// ---- 镜像实体约定：所有写入镜像的行都带 uid 字段作为主键 ----

export interface MirrorEntity {
	uid: string;
	// 服务端 int id；离线创建尚未同步时为 null
	id: number | null;
	// 客户端最后一次本地修改时间（ISO）
	pendingModifiedAt?: string;
	[key: string]: unknown;
}

export async function saveMirrorEntities(
	store: MirrorStore,
	rows: Record<string, unknown>[],
): Promise<void> {
	if (rows.length === 0) return;
	const db = await getDb();
	const tx = db.transaction(store, "readwrite");
	for (const row of rows) {
		await tx.store.put(row);
	}
	await tx.done;
}

export async function replaceMirrorStore(
	store: MirrorStore,
	rows: Record<string, unknown>[],
): Promise<void> {
	// 全量拉取成功后调用：清掉本地已删除的行再写入
	const db = await getDb();
	const tx = db.transaction(store, "readwrite");
	await tx.store.clear();
	for (const row of rows) {
		await tx.store.put(row);
	}
	await tx.done;
}

export async function listMirrorEntities<T = MirrorEntity>(
	store: MirrorStore,
): Promise<T[]> {
	const db = await getDb();
	return (await db.getAll(store)) as T[];
}

export async function getMirrorEntity<T = MirrorEntity>(
	store: MirrorStore,
	uid: string,
): Promise<T | undefined> {
	const db = await getDb();
	return (await db.get(store, uid)) as T | undefined;
}

export async function putMirrorEntity(
	store: MirrorStore,
	row: Record<string, unknown>,
): Promise<void> {
	const db = await getDb();
	await db.put(store, row);
}

export async function deleteMirrorEntity(
	store: MirrorStore,
	key: IDBValidKey,
): Promise<void> {
	const db = await getDb();
	await db.delete(store, key);
}

// ---- outbox ----

export async function putOutboxOp(op: OutboxOp): Promise<void> {
	const db = await getDb();
	await db.put("outbox", op);
}

export async function deleteOutboxOps(opIds: string[]): Promise<void> {
	if (opIds.length === 0) return;
	const db = await getDb();
	const tx = db.transaction("outbox", "readwrite");
	for (const opId of opIds) {
		await tx.store.delete(opId);
	}
	await tx.done;
}

export async function getAllOutboxOps(): Promise<OutboxOp[]> {
	const db = await getDb();
	return (await db.getAll("outbox")) as OutboxOp[];
}

export async function clearOutbox(): Promise<void> {
	const db = await getDb();
	await db.clear("outbox");
}

// ---- meta ----

export async function getMeta<T>(key: string): Promise<T | undefined> {
	const db = await getDb();
	return (await db.get("meta", key)) as T | undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
	const db = await getDb();
	await db.put("meta", value, key);
}
