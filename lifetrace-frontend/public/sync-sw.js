// Minimal background outbox pusher. Pulling and conflict presentation stay in
// the page engine because they depend on TanStack Query and Zustand.
// 页面引擎按用户使用 lifetrace-offline-user-{id} / -anonymous 分库，这里统一枚举前缀。
const OFFLINE_DB_PREFIX = "lifetrace-offline";

async function listOfflineDbNames() {
	if (typeof indexedDB.databases === "function") {
		try {
			const dbs = await indexedDB.databases();
			const names = dbs
				.map((db) => db.name)
				.filter((name) => name && name.startsWith(OFFLINE_DB_PREFIX));
			if (names.length) return names;
		} catch {}
	}
	return [OFFLINE_DB_PREFIX];
}

function openOfflineDb(name) {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(name, 1);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(transaction) {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = resolve;
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
	});
}

async function readStore(db, storeName) {
	return new Promise((resolve, reject) => {
		const request = db.transaction(storeName).objectStore(storeName).getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function readMeta(db, key) {
	return new Promise((resolve, reject) => {
		const request = db.transaction("meta").objectStore("meta").get(key);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function writeMeta(db, key, value) {
	const transaction = db.transaction("meta", "readwrite");
	transaction.objectStore("meta").put(value, key);
	await transactionDone(transaction);
}

async function removeCompleted(db, ids) {
	const transaction = db.transaction("outbox", "readwrite");
	const store = transaction.objectStore("outbox");
	for (const id of ids) store.delete(id);
	await transactionDone(transaction);
}

function camelize(value) {
	if (Array.isArray(value)) return value.map(camelize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
				camelize(item),
			]),
		);
	}
	return value;
}

async function updateIdMap(db, results) {
	for (const raw of results) {
		const result = camelize(raw);
		if (!result.entity || result.entityType === "habit_record") continue;
		const storeName = result.entityType;
		if (!["todo", "journal", "habit"].includes(storeName)) continue;
		const transaction = db.transaction(storeName, "readwrite");
		transaction.objectStore(storeName).put({
			...result.entity,
			uid: result.uid,
			id: result.serverId ?? result.entity.id,
			pendingSync: false,
		});
		await transactionDone(transaction);
	}
}

self.flushLifeTraceOutbox = async function flushLifeTraceOutbox() {
	const dbNames = await listOfflineDbNames();
	for (const dbName of dbNames) {
		const db = await openOfflineDb(dbName);
		try {
			const ops = (await readStore(db, "outbox")).sort(
				(a, b) => new Date(a.queuedAt) - new Date(b.queuedAt),
			);
			if (!ops.length) continue;
			const ordered = [];
			const pending = [...ops];
			const resolved = new Set();
			while (pending.length) {
				const index = pending.findIndex((op) =>
					(op.dependsOn ?? []).every(
						(uid) => resolved.has(uid) || !pending.some((item) => item.uid === uid),
					),
				);
				const [op] = pending.splice(index < 0 ? 0 : index, 1);
				ordered.push(op);
				resolved.add(op.uid);
			}
			let clientId = await readMeta(db, "sync.clientId");
			if (!clientId) {
				clientId = crypto.randomUUID();
				await writeMeta(db, "sync.clientId", clientId);
			}
			const response = await fetch("/api/sync/push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ clientId, ops: ordered }),
			});
			if (!response.ok) throw new Error(`Background sync failed (${response.status})`);
			const data = await response.json();
			await updateIdMap(db, data.results);
			const completed = data.results
				.filter((result) => result.status !== "error")
				.map((result) => result.opId ?? result.op_id);
			await removeCompleted(db, completed);
		} finally {
			db.close();
		}
	}
};
