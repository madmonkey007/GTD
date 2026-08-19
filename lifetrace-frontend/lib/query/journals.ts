"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { customFetcher, isOfflineError, unwrapApiData } from "@/lib/api/fetcher";
import {
	autoLinkJournalApiJournalsAutoLinkPost,
	createJournalApiJournalsPost,
	deleteJournalApiJournalsJournalIdDelete,
	generateAiJournalApiJournalsGenerateAiPost,
	generateObjectiveJournalApiJournalsGenerateObjectivePost,
	listJournalsApiJournalsGet,
	updateJournalApiJournalsJournalIdPut,
	useListJournalsApiJournalsGet,
} from "@/lib/generated/journals/journals";
import type {
	JournalAutoLinkRequest,
	JournalAutoLinkResponse,
	JournalCreate,
	JournalGenerateRequest,
	JournalGenerateResponse,
	JournalListResponse,
	JournalResponse,
	JournalUpdate,
	ListJournalsApiJournalsGetParams,
} from "@/lib/generated/schemas";
import { listMirrorEntities } from "@/lib/offline/db";
import { newUid } from "@/lib/offline/ids";
import { saveServerList } from "@/lib/offline/mirror";
import {
	isOffline,
	offlineCreateJournal,
	offlineDeleteJournal,
	offlineUpdateJournal,
	saveJournalToMirror,
} from "@/lib/offline/writes";
import { queryKeys } from "./keys";

interface UseJournalsParams {
	limit?: number;
	offset?: number;
	startDate?: string;
	endDate?: string;
	search?: string;
	origin?: string;
	origins?: string;
	/** 延迟加载开关（false 时不发请求） */
	enabled?: boolean;
}

export function extractTagsFromContent(userNotes: string): string[] {
	const matches = userNotes.match(/#([^\s#]+)(\s|$)/g);
	if (!matches) return [];
	return [...new Set(matches.map((m) => m.slice(1).trimEnd()))];
}

export interface JournalLiteRow {
	id: number;
	name: string;
	date: string;
	createdAt: string;
	userNotes: string;
}

export interface JournalLiteListData {
	total: number;
	notes: JournalLiteRow[];
}

interface UseJournalLitesParams {
	limit?: number;
	offset?: number;
	startDate?: string;
	endDate?: string;
	enabled?: boolean;
}

/** 轻量笔记列表：仅 id/name/date/createdAt/userNotes（服务端无 N+1，统计/标签/时光机/聊天上下文用） */
export function useJournalLites(params?: UseJournalLitesParams) {
	const { enabled: _enabled, ...keyParams } = params ?? {};
	const queryParams = {
		limit: keyParams.limit ?? 1000,
		offset: keyParams.offset ?? 0,
		start_date: keyParams.startDate,
		end_date: keyParams.endDate,
	};

	return useQuery({
		queryKey: queryKeys.journals.lite(keyParams),
		staleTime: 5 * 60 * 1000,
		enabled: params?.enabled ?? true,
		queryFn: async ({ signal }) => {
			const search = new URLSearchParams();
			search.set("limit", String(queryParams.limit));
			search.set("offset", String(queryParams.offset));
			if (queryParams.start_date) search.set("start_date", queryParams.start_date);
			if (queryParams.end_date) search.set("end_date", queryParams.end_date);
			const res = await customFetcher<JournalLiteListData>(
				`/api/journals/lite?${search.toString()}`,
				{ signal },
			);
			return unwrapApiData<JournalLiteListData>(res) ?? { total: 0, notes: [] };
		},
	});
}

export const normalizeJournal = (raw: Record<string, unknown>) => {
	const userNotes = (raw.userNotes as string) ?? "";
	// 标签始终从正文 #tag 提取，不显示 DB 中旧的独立标签（用户已确认不需要独立标签体系）
	const contentTags = extractTagsFromContent(userNotes);

	const rawRelatedTodos = (raw.relatedTodos as Array<Record<string, unknown>>) ?? (raw.related_todos as Array<Record<string, unknown>>) ?? [];

	return {
		id: raw.id as number,
		uid: (raw.uid as string) ?? null,
		name: (raw.name as string) ?? "",
		userNotes,
		date: raw.date as string,
		contentFormat: (raw.contentFormat as string) ?? "markdown",
		contentObjective: (raw.contentObjective as string) ?? null,
		contentAi: (raw.contentAi as string) ?? null,
		mood: (raw.mood as string) ?? null,
		energy: (raw.energy as number) ?? null,
		dayBucketStart: (raw.dayBucketStart as string) ?? null,
		createdAt: raw.createdAt as string,
		updatedAt: raw.updatedAt as string,
		deletedAt: (raw.deletedAt as string) ?? null,
		origin: (raw.origin as string) ?? "manual",
		tags: contentTags.map((t) => ({ id: 0, tagName: t })),
		relatedTodoIds: (raw.relatedTodoIds as number[]) ?? (raw.related_todo_ids as number[]) ?? [],
		relatedActivityIds: (raw.relatedActivityIds as number[]) ?? (raw.related_activity_ids as number[]) ?? [],
		relatedNoteIds: (raw.relatedNoteIds as number[]) ?? (raw.related_note_ids as number[]) ?? [],
		relatedTodos: rawRelatedTodos.map((t) => ({
			id: (t.id as number) ?? 0,
			name: (t.name as string) ?? "",
			role: (t.role as string | null) ?? null,
		})),
	};
};

const normalizeAutoLinkResponse = (raw: Record<string, unknown>) => ({
	relatedTodoIds: (raw.relatedTodoIds as number[]) ?? [],
	relatedActivityIds: (raw.relatedActivityIds as number[]) ?? [],
	todoCandidates: (raw.todoCandidates as Array<Record<string, unknown>>) ?? [],
	activityCandidates:
		(raw.activityCandidates as Array<Record<string, unknown>>) ?? [],
});

export type JournalView = ReturnType<typeof normalizeJournal>;
export type JournalAutoLinkResult = ReturnType<typeof normalizeAutoLinkResponse>;

export function useJournals(params?: UseJournalsParams) {
	const queryParams: ListJournalsApiJournalsGetParams = {
		limit: params?.limit ?? 50,
		offset: params?.offset ?? 0,
		start_date: params?.startDate,
		end_date: params?.endDate,
		search: params?.search,
		origin: params?.origin,
		origins: params?.origins,
	};
	// enabled 只控制是否发请求，不参与 queryKey（否则开关翻转会换 key 重新拉取）
	const { enabled: _enabled, ...keyParams } = params ?? {};

	return useListJournalsApiJournalsGet(queryParams, {
		query: {
			queryKey: queryKeys.journals.list(keyParams),
			staleTime: 5 * 60 * 1000,
			enabled: params?.enabled ?? true,
			retry: (count, err) => (isOfflineError(err) ? false : count < 3),
			retryDelay: (attemptIndex) =>
				Math.min(1000 * 2 ** attemptIndex, 10000),
			queryFn: async ({ signal }) => {
				try {
					const res = await listJournalsApiJournalsGet(queryParams, {
						signal,
					});
					const data = unwrapApiData<JournalListResponse>(res);
					const rows = (data?.journals ?? []) as unknown as Record<
						string,
						unknown
					>[];
					await saveServerList(
						"journal",
						"journal",
						rows.map((raw) => ({
							...normalizeJournal(raw),
							uid: (raw.uid as string) ?? `srv-${raw.id}`,
						})),
					);
					return res;
				} catch (err) {
					if (isOfflineError(err)) {
						const mirrorRows = await listMirrorEntities<
							Record<string, unknown>
						>("journal");
						return { total: mirrorRows.length, journals: mirrorRows } as unknown as Awaited<
							ReturnType<typeof listJournalsApiJournalsGet>
						>;
					}
					throw err;
				}
			},
			select: (data: unknown) => {
				const response =
					unwrapApiData<JournalListResponse>(data) ?? {
						total: 0,
						journals: [],
					};
				const journals = (response.journals ?? []).map((journal) =>
					normalizeJournal(journal as unknown as Record<string, unknown>),
				);
				return {
					total: response.total ?? 0,
					journals,
				};
			},
		},
	});
}

const createJournal = async (input: JournalCreate): Promise<JournalView | null> => {
	// 在线创建也带上客户端生成的 uid：配合服务端 uid-upsert，重试/双击不会产生重复笔记
	if (!input.uid) {
		input = { ...input, uid: newUid() };
	}
	if (isOffline()) {
		return normalizeJournal(
			await offlineCreateJournal(input as unknown as Record<string, unknown>),
		);
	}
	try {
		const response = await createJournalApiJournalsPost(input);
		const data = unwrapApiData<JournalResponse>(response);
		if (!data) return null;
		await saveJournalToMirror(
			normalizeJournal(data as unknown as Record<string, unknown>),
		);
		return normalizeJournal(data as unknown as Record<string, unknown>);
	} catch (err) {
		if (isOfflineError(err)) {
			return normalizeJournal(
				await offlineCreateJournal(input as unknown as Record<string, unknown>),
			);
		}
		throw err;
	}
};

const updateJournal = async (id: number, input: JournalUpdate): Promise<JournalView | null> => {
	if (isOffline()) {
		return normalizeJournal(
			await offlineUpdateJournal(id, input as unknown as Record<string, unknown>),
		);
	}
	try {
		const response = await updateJournalApiJournalsJournalIdPut(id, input);
		const data = unwrapApiData<JournalResponse>(response);
		if (!data) return null;
		return normalizeJournal(data as unknown as Record<string, unknown>);
	} catch (err) {
		if (isOfflineError(err)) {
			return normalizeJournal(
				await offlineUpdateJournal(id, input as unknown as Record<string, unknown>),
			);
		}
		throw err;
	}
};

const autoLinkJournal = async (input: JournalAutoLinkRequest) => {
	const response = await autoLinkJournalApiJournalsAutoLinkPost(input);
	const data = unwrapApiData<JournalAutoLinkResponse>(response);
	return data
		? normalizeAutoLinkResponse(data as Record<string, unknown>)
		: normalizeAutoLinkResponse({});
};

const generateObjective = async (input: JournalGenerateRequest) => {
	const response = await generateObjectiveJournalApiJournalsGenerateObjectivePost(
		input,
	);
	const data = unwrapApiData<JournalGenerateResponse>(response);
	return data ?? { content: "" };
};

const generateAiView = async (input: JournalGenerateRequest) => {
	const response = await generateAiJournalApiJournalsGenerateAiPost(input);
	const data = unwrapApiData<JournalGenerateResponse>(response);
	return data ?? { content: "" };
};

const deleteJournal = async (journalId: number) => {
	if (isOffline()) {
		await offlineDeleteJournal(journalId);
		return journalId;
	}
	try {
		await deleteJournalApiJournalsJournalIdDelete(journalId);
		return journalId;
	} catch (err) {
		if (isOfflineError(err)) {
			await offlineDeleteJournal(journalId);
			return journalId;
		}
		throw err;
	}
};

interface JournalListBody {
	total: number;
	journals: unknown[];
}

/** 缓存里的列表响应可能是裸 {total,journals} 或 {data:{...}} 信封，统一取出/装回 */
function rewriteListResponse(
	raw: unknown,
	mutate: (body: JournalListBody) => JournalListBody | null,
): unknown {
	const body = unwrapApiData<{ total?: number; journals?: unknown[] }>(raw);
	if (!body || !Array.isArray(body.journals)) return raw;
	const next = mutate({ total: body.total ?? body.journals.length, journals: body.journals });
	if (!next) return raw;
	if (raw && typeof raw === "object" && "data" in raw) {
		return { ...(raw as Record<string, unknown>), data: next };
	}
	return next;
}

/** 遍历所有 journal 缓存（列表/详情），apply 返回新值时写回 */
function forEachJournalCache(
	queryClient: QueryClient,
	apply: (key: readonly unknown[], raw: unknown) => unknown,
) {
	for (const [key, raw] of queryClient.getQueriesData({ queryKey: queryKeys.journals.all })) {
		const next = apply(key, raw);
		if (next !== raw) queryClient.setQueryData(key, next);
	}
}

/** JournalView 记录 → 轻量行（lite 缓存的形状） */
function toLiteRow(record: Record<string, unknown>): JournalLiteRow {
	return {
		id: record.id as number,
		name: (record.name as string) ?? "",
		date: record.date as string,
		createdAt: (record.createdAt as string) ?? (record.created_at as string) ?? "",
		userNotes: (record.userNotes as string) ?? (record.user_notes as string) ?? "",
	};
}

function rewriteLiteResponse(
	raw: unknown,
	mutate: (body: JournalLiteListData) => JournalLiteListData | null,
): unknown {
	const body = raw as JournalLiteListData | undefined;
	if (!body || !Array.isArray(body.notes)) return raw;
	const next = mutate(body);
	if (!next) return raw;
	return next;
}

/** 新建笔记直接写进所有匹配的列表缓存：列表/统计即时更新，不再全量 refetch */
function prependJournalToCaches(queryClient: QueryClient, record: Record<string, unknown>) {
	const id = record.id as number;
	const noteTime = record.date ? new Date(record.date as string).getTime() : Date.now();
	forEachJournalCache(queryClient, (key, raw) => {
		if (key[1] === "lite") {
			const params = (key[2] ?? {}) as Record<string, unknown>;
			if (params.search) return raw;
			if (typeof params.offset === "number" && params.offset > 0) return raw;
			if (params.start_date && noteTime < new Date(params.start_date as string).getTime()) return raw;
			if (params.end_date && noteTime > new Date(params.end_date as string).getTime()) return raw;
			return rewriteLiteResponse(raw, (body) => {
				const idx = body.notes.findIndex((n) => n.id === id);
				const row = toLiteRow(record);
				if (idx >= 0) {
					const notes = [...body.notes];
					notes[idx] = row;
					return { ...body, notes };
				}
				return { total: body.total + 1, notes: [row, ...body.notes] };
			});
		}
		if (key[1] !== "list") return raw;
		const params = (key[2] ?? {}) as Record<string, unknown>;
		// 搜索词过滤无法本地判断匹配，跳过（等下次自然刷新）
		if (params.search) return raw;
		// 来源过滤：新笔记的 origin 能确定时按其判断
		if (params.origins && typeof params.origins === "string") {
			const allowed = (params.origins as string).split(",");
			if (!allowed.includes(String(record.origin ?? "manual"))) return raw;
		} else if (params.origin && params.origin !== String(record.origin ?? "manual")) {
			return raw;
		}
		// 翻页缓存跳过，避免插入错位
		if (typeof params.offset === "number" && params.offset > 0) return raw;
		if (params.start_date && noteTime < new Date(params.start_date as string).getTime()) return raw;
		if (params.end_date && noteTime > new Date(params.end_date as string).getTime()) return raw;
		return rewriteListResponse(raw, (body) => {
			const idx = body.journals.findIndex((j) => (j as { id?: number })?.id === id);
			if (idx >= 0) {
				const journals = [...body.journals];
				journals[idx] = record;
				return { ...body, journals };
			}
			return { total: body.total + 1, journals: [record, ...body.journals] };
		});
	});
}

/** 编辑笔记就地替换缓存中的同 id 记录（含详情与 lite 缓存） */
function replaceJournalInCaches(queryClient: QueryClient, record: Record<string, unknown>) {
	const id = record.id as number;
	forEachJournalCache(queryClient, (key, raw) => {
		if (key[1] === "lite") {
			return rewriteLiteResponse(raw, (body) => {
				const idx = body.notes.findIndex((n) => n.id === id);
				if (idx < 0) return null;
				const notes = [...body.notes];
				notes[idx] = toLiteRow(record);
				return { ...body, notes };
			});
		}
		if (key[1] === "detail") {
			if (key[2] !== id) return raw;
			const body = unwrapApiData<Record<string, unknown>>(raw);
			if (!body || (body as { id?: number }).id !== id) return raw;
			if (raw && typeof raw === "object" && "data" in raw) {
				return { ...(raw as Record<string, unknown>), data: record };
			}
			return record;
		}
		return rewriteListResponse(raw, (body) => {
			const idx = body.journals.findIndex((j) => (j as { id?: number })?.id === id);
			if (idx < 0) return null;
			const journals = [...body.journals];
			journals[idx] = record;
			return { ...body, journals };
		});
	});
}

/** NoteLink 增删后本地更新源/目标两篇笔记的 relatedNoteIds（lite 不含关联字段，无需处理） */
export function patchNoteLinkInCaches(
	queryClient: QueryClient,
	opts: { sourceNoteId: number; targetNoteId: number; linked: boolean },
) {
	const { sourceNoteId, targetNoteId, linked } = opts;
	const patchRecord = (rec: Record<string, unknown>) => {
		const id = rec.id as number;
		if (id !== sourceNoteId && id !== targetNoteId) return rec;
		const other = id === sourceNoteId ? targetNoteId : sourceNoteId;
		const keyName = Array.isArray(rec.relatedNoteIds)
			? "relatedNoteIds"
			: Array.isArray(rec.related_note_ids)
				? "related_note_ids"
				: null;
		if (!keyName) return rec;
		const cur = (rec[keyName] as number[]) ?? [];
		const next = linked
			? cur.includes(other)
				? cur
				: [...cur, other]
			: cur.filter((x) => x !== other);
		if (next === cur || next.length === cur.length) return rec;
		return { ...rec, [keyName]: next };
	};
	forEachJournalCache(queryClient, (key, raw) => {
		if (key[1] === "lite") return raw;
		if (key[1] === "detail") {
			const detailId = key[2];
			if (detailId !== sourceNoteId && detailId !== targetNoteId) return raw;
			const body = unwrapApiData<Record<string, unknown>>(raw);
			if (!body || body.id !== detailId) return raw;
			const patched = patchRecord(body);
			if (patched === body) return raw;
			if (raw && typeof raw === "object" && "data" in raw) {
				return { ...(raw as Record<string, unknown>), data: patched };
			}
			return patched;
		}
		return rewriteListResponse(raw, (body) => {
			let changed = false;
			const journals = body.journals.map((j) => {
				const patched = patchRecord(j as Record<string, unknown>);
				if (patched !== j) changed = true;
				return patched;
			});
			return changed ? { ...body, journals } : null;
		});
	});
}

/** 删除笔记后本地移除所有 list/lite/detail 缓存（即时刷新，不再全量 refetch） */
function removeJournalFromCaches(queryClient: QueryClient, id: number) {
	queryClient.removeQueries({ queryKey: queryKeys.journals.detail(id) });
	forEachJournalCache(queryClient, (key, raw) => {
		if (key[1] === "lite") {
			return rewriteLiteResponse(raw, (body) => {
				const next = body.notes.filter((n) => n.id !== id);
				if (next.length === body.notes.length) return null;
				return { ...body, total: body.total - 1, notes: next };
			});
		}
		if (key[1] !== "list") return raw;
		return rewriteListResponse(raw, (body) => {
			const next = body.journals.filter(
				(j) => (j as { id?: number })?.id !== id,
			);
			if (next.length === body.journals.length) return null;
			return { ...body, total: body.total - 1, journals: next };
		});
	});
}

export function useJournalMutations() {
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		mutationFn: createJournal,
		onSuccess: (saved) => {
			if (saved) {
				prependJournalToCaches(queryClient, saved as unknown as Record<string, unknown>);
			}
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: number; input: JournalUpdate }) =>
			updateJournal(id, input),
		onSuccess: (saved) => {
			if (saved) {
				replaceJournalInCaches(queryClient, saved as unknown as Record<string, unknown>);
			}
			// 镜像笔记回写只影响待办详情的背景/备注，只失效 detail，
			// 不再全量失效 todos（否则左侧栏 limit 2000 的大列表每次保存都重拉）
			queryClient.invalidateQueries({ queryKey: ["todos", "detail"] });
		},
	});

	const autoLinkMutation = useMutation({
		mutationFn: autoLinkJournal,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const objectiveMutation = useMutation({
		mutationFn: generateObjective,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const aiMutation = useMutation({
		mutationFn: generateAiView,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteJournal,
		onSuccess: (journalId) => {
			if (journalId != null) {
				removeJournalFromCaches(queryClient, journalId);
			}
		},
	});

	return {
		createJournal: createMutation.mutateAsync,
		updateJournal: (id: number, input: JournalUpdate) =>
			updateMutation.mutateAsync({ id, input }),
		autoLinkJournal: autoLinkMutation.mutateAsync,
		generateObjective: objectiveMutation.mutateAsync,
		generateAiView: aiMutation.mutateAsync,
		deleteJournal: deleteMutation.mutateAsync,
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
		isAutoLinking: autoLinkMutation.isPending,
		isGeneratingObjective: objectiveMutation.isPending,
		isGeneratingAi: aiMutation.isPending,
		createError: createMutation.error,
		updateError: updateMutation.error,
	};
}
