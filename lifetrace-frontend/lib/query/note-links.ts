"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrapApiData } from "@/lib/api/fetcher";
import {
	createLinkApiNotesSourceIdLinksPost,
	deleteLinkApiNoteLinksLinkIdDelete,
	linkCandidatesApiNotesNoteIdLinkCandidatesGet,
	listLinksApiNotesNoteIdLinksGet,
	updateLinkApiNoteLinksLinkIdPut,
} from "@/lib/generated/note-links/note-links";
import type {
	LinkCandidate,
	NoteLinkListResponse,
	NoteLinkResponse,
	NoteLinkResponseRelationType,
} from "@/lib/generated/schemas";
import { queryKeys } from "./keys";
import { patchNoteLinkInCaches } from "./journals";

export const RELATION_TYPES = [
	"SUPPORTS",
	"EXTENDS",
	"CONTRADICTS",
	"RELATES",
] as const;

export type RelationType = NoteLinkResponseRelationType;

export interface NoteCounterpartView {
	id: number;
	name: string;
	date: string | null;
	preview: string;
}

export interface NoteLinkView {
	id: number;
	sourceNoteId: number;
	targetNoteId: number;
	relationType: RelationType;
	userNote: string | null;
	createdAt: string;
	counterpart: NoteCounterpartView | null;
}

export interface NoteLinksView {
	outgoing: NoteLinkView[];
	incoming: NoteLinkView[];
}

export interface LinkCandidateView {
	id: number;
	name: string;
	preview: string;
	score: number;
}

const normalizeCounterpart = (
	raw: Record<string, unknown> | null | undefined,
): NoteCounterpartView | null => {
	if (!raw) return null;
	return {
		id: raw.id as number,
		name: (raw.name as string) ?? "",
		date: (raw.date as string) ?? null,
		preview: (raw.preview as string) ?? "",
	};
};

// 注意：customFetcher 会把响应键 snake→camel（fetcher.ts:167），
// 因此这里读 camelCase 键（与 journals.ts 的 normalizeJournal 一致）。
const normalizeLink = (raw: Record<string, unknown>): NoteLinkView => ({
	id: raw.id as number,
	sourceNoteId: raw.sourceNoteId as number,
	targetNoteId: raw.targetNoteId as number,
	relationType: (raw.relationType as RelationType) ?? "RELATES",
	userNote: (raw.userNote as string) ?? null,
	createdAt: raw.createdAt as string,
	counterpart: normalizeCounterpart(
		raw.counterpart as Record<string, unknown> | null | undefined,
	),
});

/** 创建/更新链接的输入（camelCase，内部转 snake 调用生成客户端） */
export interface NoteLinkInput {
	targetNoteId: number;
	relationType?: RelationType;
	userNote?: string | null;
}

export function useNoteLinks(noteId: number | null | undefined) {
	return useQuery({
		queryKey: queryKeys.noteLinks.links(noteId ?? 0),
		enabled: !!noteId,
		staleTime: 30 * 1000,
		queryFn: async () => {
			const response = await listLinksApiNotesNoteIdLinksGet(noteId as number);
			const data = unwrapApiData<NoteLinkListResponse>(response);
			return {
				outgoing: (data?.outgoing ?? []).map((l) =>
					normalizeLink(l as unknown as Record<string, unknown>),
				),
				incoming: (data?.incoming ?? []).map((l) =>
					normalizeLink(l as unknown as Record<string, unknown>),
				),
			} as NoteLinksView;
		},
	});
}

export function useLinkCandidates(
	noteId: number | null | undefined,
	topK = 10,
) {
	return useQuery({
		queryKey: queryKeys.noteLinks.candidates(noteId ?? 0),
		enabled: !!noteId,
		staleTime: 30 * 1000,
		queryFn: async () => {
			const response = await linkCandidatesApiNotesNoteIdLinkCandidatesGet(
				noteId as number,
				{ top_k: topK },
			);
			const data = unwrapApiData<{ candidates?: LinkCandidate[] }>(response);
			return (data?.candidates ?? []).map((c) => ({
				id: c.id,
				name: c.name ?? "",
				preview: c.preview,
				score: c.score,
			})) as LinkCandidateView[];
		},
	});
}

export function useNoteLinkMutations() {
	const queryClient = useQueryClient();

	// NoteLink 变更只影响链接列表本身和源/目标两篇笔记的 relatedNoteIds：
	// 前者 invalidate（轻请求），后者本地补丁缓存，不再全量 refetch journals
	const invalidate = (
		noteId?: number,
		link?: Pick<NoteLinkView, "sourceNoteId" | "targetNoteId"> | null,
		linked = true,
	) => {
		queryClient.invalidateQueries({ queryKey: queryKeys.noteLinks.all });
		if (link) {
			patchNoteLinkInCaches(queryClient, {
				sourceNoteId: link.sourceNoteId,
				targetNoteId: link.targetNoteId,
				linked,
			});
		}
		if (noteId) {
			queryClient.invalidateQueries({
				queryKey: queryKeys.noteLinks.candidates(noteId),
			});
		}
	};

	const createMutation = useMutation({
		mutationFn: async ({
			sourceNoteId,
			input,
		}: {
			sourceNoteId: number;
			input: NoteLinkInput;
		}) => {
			let data: NoteLinkResponse | null | undefined;
			try {
				const response = await createLinkApiNotesSourceIdLinksPost(sourceNoteId, {
					target_note_id: input.targetNoteId,
					relation_type: input.relationType ?? "RELATES",
					user_note: input.userNote ?? null,
				});
				data = unwrapApiData<NoteLinkResponse>(response);
			} catch (err) {
				// 409 = 两篇笔记已关联：按幂等成功处理，仍走缓存补丁
				// （不用 instanceof ApiError，双模块实例下会判定失败）
				if ((err as { status?: number })?.status === 409) {
					return { sourceNoteId, targetNoteId: input.targetNoteId };
				}
				throw err;
			}
			return data
				? normalizeLink(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (data, vars) => invalidate(vars.sourceNoteId, data, true),
	});

	const updateMutation = useMutation({
		mutationFn: async ({
			linkId,
			input,
		}: {
			linkId: number;
			input: { relationType?: RelationType; userNote?: string | null };
		}) => {
			const response = await updateLinkApiNoteLinksLinkIdPut(linkId, {
				relation_type: input.relationType,
				user_note: input.userNote,
			});
			const data = unwrapApiData<NoteLinkResponse>(response);
			return data
				? normalizeLink(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (data) => invalidate(undefined, data, true),
	});

	const deleteMutation = useMutation({
		// 传完整 link 而非裸 id：删除后需要 source/target 在本地缓存中回退 relatedNoteIds
		mutationFn: async (link: Pick<NoteLinkView, "id" | "sourceNoteId" | "targetNoteId">) => {
			await deleteLinkApiNoteLinksLinkIdDelete(link.id);
			return link;
		},
		onSuccess: (link) => invalidate(undefined, link, false),
	});

	return {
		createNoteLink: createMutation.mutate,
		createNoteLinkAsync: createMutation.mutateAsync,
		updateNoteLink: updateMutation.mutate,
		deleteNoteLink: deleteMutation.mutate,
		isPending:
			createMutation.isPending ||
			updateMutation.isPending ||
			deleteMutation.isPending,
	};
}
