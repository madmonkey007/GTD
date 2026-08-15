"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isOfflineError, unwrapApiData } from "@/lib/api/fetcher";
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
}

function extractTagsFromContent(userNotes: string): string[] {
	const matches = userNotes.match(/#([^\s#]+)(\s|$)/g);
	if (!matches) return [];
	return [...new Set(matches.map((m) => m.slice(1).trimEnd()))];
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

	return useListJournalsApiJournalsGet(queryParams, {
		query: {
			queryKey: queryKeys.journals.list(params),
			staleTime: 30 * 1000,
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
		return;
	}
	try {
		await deleteJournalApiJournalsJournalIdDelete(journalId);
	} catch (err) {
		if (isOfflineError(err)) {
			await offlineDeleteJournal(journalId);
			return;
		}
		throw err;
	}
};

export function useJournalMutations() {
	const queryClient = useQueryClient();

	const createMutation = useMutation({
		mutationFn: createJournal,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: number; input: JournalUpdate }) =>
			updateJournal(id, input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
			// 镜像笔记回写后，待办详情的背景/备注需刷新
			queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
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
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.journals.all });
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
