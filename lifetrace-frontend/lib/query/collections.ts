"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetcher } from "@/lib/api/fetcher";
import { queryKeys } from "./keys";

export interface CollectionNoteView {
	id: number;
	name: string | null;
	date: string | null;
	preview: string;
}

export interface CollectionView {
	id: number;
	uid: string;
	name: string;
	description: string | null;
	coverImageUrl: string | null;
	noteCount: number;
	createdAt: string;
	updatedAt: string;
	/** 仅详情接口返回 */
	notes: CollectionNoteView[] | null;
}

export interface CollectionRecommendItemView {
	journalId: number;
	name: string | null;
	reason: string;
}

export interface CollectionInput {
	name?: string;
	description?: string | null;
	coverImageUrl?: string | null;
}

const normalizeCollection = (raw: Record<string, unknown>): CollectionView => ({
	id: raw.id as number,
	uid: (raw.uid as string) ?? "",
	name: (raw.name as string) ?? "",
	description: (raw.description as string) ?? null,
	coverImageUrl: (raw.coverImageUrl as string) ?? null,
	noteCount: (raw.noteCount as number) ?? 0,
	createdAt: (raw.createdAt as string) ?? "",
	updatedAt: (raw.updatedAt as string) ?? "",
	notes: raw.notes
		? (raw.notes as Record<string, unknown>[]).map((n) => ({
				id: n.id as number,
				name: (n.name as string) ?? null,
				date: (n.date as string) ?? null,
				preview: (n.preview as string) ?? "",
			}))
		: null,
});

/** 所有集合列表（带 noteCount，不含 notes） */
export function useCollections() {
	return useQuery({
		queryKey: queryKeys.collections.list,
		staleTime: 30 * 1000,
		queryFn: async () => {
			const data = await customFetcher<CollectionView[]>("/api/collections");
			return (data ?? []).map((c) =>
				normalizeCollection(c as unknown as Record<string, unknown>),
			);
		},
	});
}

/** 单个集合详情（含 notes） */
export function useCollection(id: number | null | undefined) {
	return useQuery({
		queryKey: queryKeys.collections.detail(id ?? 0),
		enabled: !!id,
		staleTime: 15 * 1000,
		queryFn: async () => {
			const data = await customFetcher<CollectionView>(
				`/api/collections/${id}`,
			);
			return data
				? normalizeCollection(data as unknown as Record<string, unknown>)
				: null;
		},
	});
}

export function useCollectionMutations() {
	const queryClient = useQueryClient();

	const invalidateAll = () => {
		queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
		// 集合成员变化也影响 journals 视图（如集合内笔记列表），一并刷新
		queryClient.invalidateQueries({
			queryKey: queryKeys.journals.all,
			refetchType: "all",
		});
	};

	const invalidateDetail = (id: number) => {
		invalidateAll();
		queryClient.invalidateQueries({
			queryKey: queryKeys.collections.detail(id),
		});
	};

	const createMutation = useMutation({
		mutationFn: async (input: CollectionInput) => {
			const data = await customFetcher<CollectionView>("/api/collections", {
				method: "POST",
				data: input,
			});
			return data
				? normalizeCollection(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: () => invalidateAll(),
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, input }: { id: number; input: CollectionInput }) => {
			const data = await customFetcher<CollectionView>(
				`/api/collections/${id}`,
				{ method: "PUT", data: input },
			);
			return data
				? normalizeCollection(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: number) => {
			await customFetcher<void>(`/api/collections/${id}`, {
				method: "DELETE",
			});
			return id;
		},
		onSuccess: () => invalidateAll(),
	});

	const addNotesMutation = useMutation({
		mutationFn: async ({ id, journalIds }: { id: number; journalIds: number[] }) => {
			const data = await customFetcher<CollectionView>(
				`/api/collections/${id}/notes`,
				{ method: "POST", data: { journalIds } },
			);
			return data
				? normalizeCollection(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	const removeNoteMutation = useMutation({
		mutationFn: async ({ id, journalId }: { id: number; journalId: number }) => {
			const data = await customFetcher<CollectionView>(
				`/api/collections/${id}/notes/${journalId}`,
				{ method: "DELETE" },
			);
			return data
				? normalizeCollection(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	const summarizeMutation = useMutation({
		mutationFn: async (id: number) => {
			const data = await customFetcher<{ summary: string }>(
				`/api/collections/${id}/summarize`,
				{ method: "POST" },
			);
			return data?.summary ?? "";
		},
	});

	const recommendMutation = useMutation({
		mutationFn: async (id: number) => {
			const data = await customFetcher<{ items: CollectionRecommendItemView[] }>(
				`/api/collections/${id}/recommend`,
				{ method: "POST" },
			);
			return (data?.items ?? []) as CollectionRecommendItemView[];
		},
	});

	return {
		createCollection: createMutation.mutate,
		createCollectionAsync: createMutation.mutateAsync,
		updateCollection: updateMutation.mutate,
		updateCollectionAsync: updateMutation.mutateAsync,
		deleteCollection: deleteMutation.mutate,
		addNotes: addNotesMutation.mutate,
		addNotesAsync: addNotesMutation.mutateAsync,
		removeNote: removeNoteMutation.mutate,
		summarize: summarizeMutation.mutate,
		summarizeAsync: summarizeMutation.mutateAsync,
		summarizePending: summarizeMutation.isPending,
		recommend: recommendMutation.mutate,
		recommendAsync: recommendMutation.mutateAsync,
		recommendPending: recommendMutation.isPending,
		isPending:
			createMutation.isPending ||
			updateMutation.isPending ||
			deleteMutation.isPending ||
			addNotesMutation.isPending ||
			removeNoteMutation.isPending,
	};
}
