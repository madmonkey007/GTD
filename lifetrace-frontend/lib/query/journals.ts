"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrapApiData } from "@/lib/api/fetcher";
import {
	autoLinkJournalApiJournalsAutoLinkPost,
	createJournalApiJournalsPost,
	deleteJournalApiJournalsJournalIdDelete,
	generateAiJournalApiJournalsGenerateAiPost,
	generateObjectiveJournalApiJournalsGenerateObjectivePost,
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
import { queryKeys } from "./keys";

interface UseJournalsParams {
	limit?: number;
	offset?: number;
	startDate?: string;
	endDate?: string;
	search?: string;
}

function extractTagsFromContent(userNotes: string): string[] {
	const matches = userNotes.match(/#([^\s#]+)(\s|$)/g);
	if (!matches) return [];
	return [...new Set(matches.map((m) => m.slice(1).trimEnd()))];
}

const normalizeJournal = (raw: Record<string, unknown>) => {
	const userNotes = (raw.userNotes as string) ?? "";
	// 标签始终从正文 #tag 提取，不显示 DB 中旧的独立标签（用户已确认不需要独立标签体系）
	const contentTags = extractTagsFromContent(userNotes);

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
		tags: contentTags.map((t) => ({ id: 0, tagName: t })),
		relatedTodoIds: (raw.relatedTodoIds as number[]) ?? (raw.related_todo_ids as number[]) ?? [],
		relatedActivityIds: (raw.relatedActivityIds as number[]) ?? (raw.related_activity_ids as number[]) ?? [],
		relatedNoteIds: (raw.relatedNoteIds as number[]) ?? (raw.related_note_ids as number[]) ?? [],
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
	};

	return useListJournalsApiJournalsGet(queryParams, {
		query: {
			queryKey: queryKeys.journals.list(params),
			staleTime: 30 * 1000,
			retry: 3,
			retryDelay: (attemptIndex) =>
				Math.min(1000 * 2 ** attemptIndex, 10000),
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

const createJournal = async (input: JournalCreate) => {
	const response = await createJournalApiJournalsPost(input);
	const data = unwrapApiData<JournalResponse>(response);
	return data ? normalizeJournal(data as unknown as Record<string, unknown>) : null;
};

const updateJournal = async (id: number, input: JournalUpdate) => {
	const response = await updateJournalApiJournalsJournalIdPut(id, input);
	const data = unwrapApiData<JournalResponse>(response);
	return data ? normalizeJournal(data as unknown as Record<string, unknown>) : null;
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
	await deleteJournalApiJournalsJournalIdDelete(journalId);
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
