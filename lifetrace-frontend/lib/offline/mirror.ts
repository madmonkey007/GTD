// 实体镜像：IndexedDB 中保存与服务端一致的实体行（camelCase，含 uid）
// 在线拉取成功时更新镜像；离线写入时直接改镜像，联网后由 engine 推送
import {
	deleteMirrorEntity,
	getMirrorEntity,
	listMirrorEntities,
	type MirrorEntity,
	type MirrorStore,
	putMirrorEntity,
} from "./db";
import { pendingOpsForEntity } from "./outbox";

/**
 * 服务端列表拉取成功后写镜像。
 * 若该实体没有待推送操作（镜像与服务器一致），先清空再写，避免其他端删除的行残留；
 * 若有离线写入未推送，只 upsert，不清空（保护离线创建的行）。
 */
export async function saveServerList(
	store: MirrorStore,
	entity: "todo" | "journal" | "habit",
	rows: Array<Record<string, unknown> & { uid: string }>,
): Promise<void> {
	const pending = await pendingOpsForEntity(entity);
	if (pending.length === 0 && store !== "habitRecord") {
		const { replaceMirrorStore } = await import("./db");
		await replaceMirrorStore(store, rows);
		return;
	}
	for (const row of rows) {
		await putMirrorEntity(store, row);
	}
}

/** 按（可能是临时的）id 查 uid；离线创建的实体 id 为负数 */
export async function findUidById(
	store: MirrorStore,
	id: number | string,
): Promise<string | null> {
	const rows = await listMirrorEntities<MirrorEntity & { id: unknown }>(store);
	const row = rows.find((r) => String(r.id) === String(id));
	return row?.uid ?? null;
}

export {
	deleteMirrorEntity,
	getMirrorEntity,
	listMirrorEntities,
	putMirrorEntity,
};
export type { MirrorEntity, MirrorStore };
