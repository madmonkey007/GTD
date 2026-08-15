import { queryKeys } from "@/lib/query/keys";
import { getQueryClient } from "@/lib/query/provider";
import { listMirrorEntities } from "./db";

let hydrated: Promise<void> | null = null;

export function hydrateOfflineCache(): Promise<void> {
	if (hydrated) return hydrated;
	hydrated = (async () => {
		const [todos, journals, habits, records] = await Promise.all([
			listMirrorEntities<Record<string, unknown>>("todo"),
			listMirrorEntities<Record<string, unknown>>("journal"),
			listMirrorEntities<Record<string, unknown>>("habit"),
			listMirrorEntities<Record<string, unknown>>("habitRecord"),
		]);
		const qc = getQueryClient();
		if (!qc.getQueryData(queryKeys.todos.list()) && todos.length) {
			qc.setQueryData(queryKeys.todos.list(), { todos, total: todos.length });
		}
		if (!qc.getQueryData(queryKeys.journals.list()) && journals.length) {
			qc.setQueryData(queryKeys.journals.list(), { journals, total: journals.length });
		}
		if (!qc.getQueryData(queryKeys.habits.list({ limit: 1000 })) && habits.length) {
			qc.setQueryData(queryKeys.habits.list({ limit: 1000 }), habits);
		}
		if (!qc.getQueryData(queryKeys.habits.records) && records.length) {
			qc.setQueryData(
				queryKeys.habits.records,
				records.map((row) => ({ habitId: String(row.habitId), date: row.date })),
			);
		}
	})().catch((error) => {
		hydrated = null;
		throw error;
	});
	return hydrated;
}
