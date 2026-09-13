export interface SyncErrorInfo {
	opId: string;
	label: string;
	attempts: number;
	message: string;
}

interface DiagnosticOp {
	opId: string;
	kind: string;
	attempts: number;
	lastError?: string;
	uid?: string;
	payload?: unknown;
}

export function summarizeSyncErrors(ops: DiagnosticOp[]): SyncErrorInfo[] {
	const entities: Record<string, string> = { journal: "笔记", todo: "待办", habit: "习惯" };
	const actions: Record<string, string> = { create: "新建", update: "修改", delete: "删除", record_set: "打卡" };
	return ops.filter((op) => op.lastError).map((op) => {
		const [entity, action] = op.kind.split(".");
		return {
			opId: op.opId,
			label: `${entities[entity] ?? entity} · ${actions[action] ?? action}`,
			attempts: op.attempts,
			message: op.lastError ?? "同步失败",
		};
	});
}
