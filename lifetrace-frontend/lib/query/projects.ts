"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetcher } from "@/lib/api/fetcher";
import { queryKeys } from "./keys";

export interface ProjectTodoView {
	id: number;
	name: string | null;
	status: string | null;
	startTime: string | null;
}

export interface ProjectNoteView {
	id: number;
	name: string | null;
	date: string | null;
	preview: string;
}

export interface ProjectView {
	id: number;
	uid: string;
	name: string;
	description: string | null;
	coverImageUrl: string | null;
	color: string | null;
	todoCount: number;
	noteCount: number;
	createdAt: string;
	updatedAt: string;
	/** 仅详情接口返回 */
	todos: ProjectTodoView[] | null;
	notes: ProjectNoteView[] | null;
}

export interface ProjectInput {
	name?: string;
	description?: string | null;
	coverImageUrl?: string | null;
	color?: string | null;
}

const normalizeProject = (raw: Record<string, unknown>): ProjectView => ({
	id: raw.id as number,
	uid: (raw.uid as string) ?? "",
	name: (raw.name as string) ?? "",
	description: (raw.description as string) ?? null,
	coverImageUrl: (raw.coverImageUrl as string) ?? null,
	color: (raw.color as string) ?? null,
	todoCount: (raw.todoCount as number) ?? 0,
	noteCount: (raw.noteCount as number) ?? 0,
	createdAt: (raw.createdAt as string) ?? "",
	updatedAt: (raw.updatedAt as string) ?? "",
	todos: raw.todos
		? (raw.todos as Record<string, unknown>[]).map((t) => ({
				id: t.id as number,
				name: (t.name as string) ?? null,
				status: (t.status as string) ?? null,
				startTime: (t.startTime as string) ?? null,
			}))
		: null,
	notes: raw.notes
		? (raw.notes as Record<string, unknown>[]).map((n) => ({
				id: n.id as number,
				name: (n.name as string) ?? null,
				date: (n.date as string) ?? null,
				preview: (n.preview as string) ?? "",
			}))
		: null,
});

/** 所有项目列表（带 todoCount/noteCount，不含成员） */
export function useProjects() {
	return useQuery({
		queryKey: queryKeys.projects.list,
		staleTime: 30 * 1000,
		queryFn: async () => {
			const data = await customFetcher<ProjectView[]>("/api/projects");
			return (data ?? []).map((p) =>
				normalizeProject(p as unknown as Record<string, unknown>),
			);
		},
	});
}

/** 单个项目详情（含 todos + notes） */
export function useProject(id: number | null | undefined) {
	return useQuery({
		queryKey: queryKeys.projects.detail(id ?? 0),
		enabled: !!id,
		staleTime: 15 * 1000,
		queryFn: async () => {
			const data = await customFetcher<ProjectView>(`/api/projects/${id}`);
			return data
				? normalizeProject(data as unknown as Record<string, unknown>)
				: null;
		},
	});
}

export function useProjectMutations() {
	const queryClient = useQueryClient();

	const invalidateAll = () => {
		queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
		// 项目成员变化也影响 todos / journals 视图，一并刷新
		queryClient.invalidateQueries({
			queryKey: queryKeys.todos.all,
			refetchType: "all",
		});
		queryClient.invalidateQueries({
			queryKey: queryKeys.journals.all,
			refetchType: "all",
		});
	};

	const invalidateDetail = (id: number) => {
		invalidateAll();
		queryClient.invalidateQueries({
			queryKey: queryKeys.projects.detail(id),
		});
	};

	const createMutation = useMutation({
		mutationFn: async (input: ProjectInput) => {
			const data = await customFetcher<ProjectView>("/api/projects", {
				method: "POST",
				data: input,
			});
			return data
				? normalizeProject(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: () => invalidateAll(),
	});

	const updateMutation = useMutation({
		mutationFn: async ({ id, input }: { id: number; input: ProjectInput }) => {
			const data = await customFetcher<ProjectView>(`/api/projects/${id}`, {
				method: "PUT",
				data: input,
			});
			return data
				? normalizeProject(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: number) => {
			await customFetcher<void>(`/api/projects/${id}`, { method: "DELETE" });
			return id;
		},
		onSuccess: () => invalidateAll(),
	});

	const addTodosMutation = useMutation({
		mutationFn: async ({ id, todoIds }: { id: number; todoIds: number[] }) => {
			const data = await customFetcher<ProjectView>(
				`/api/projects/${id}/todos`,
				{ method: "POST", data: { todoIds } },
			);
			return data
				? normalizeProject(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	const removeTodoMutation = useMutation({
		mutationFn: async ({ id, todoId }: { id: number; todoId: number }) => {
			const data = await customFetcher<ProjectView>(
				`/api/projects/${id}/todos/${todoId}`,
				{ method: "DELETE" },
			);
			return data
				? normalizeProject(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	const addNotesMutation = useMutation({
		mutationFn: async ({ id, journalIds }: { id: number; journalIds: number[] }) => {
			const data = await customFetcher<ProjectView>(
				`/api/projects/${id}/notes`,
				{ method: "POST", data: { journalIds } },
			);
			return data
				? normalizeProject(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	const removeNoteMutation = useMutation({
		mutationFn: async ({ id, journalId }: { id: number; journalId: number }) => {
			const data = await customFetcher<ProjectView>(
				`/api/projects/${id}/notes/${journalId}`,
				{ method: "DELETE" },
			);
			return data
				? normalizeProject(data as unknown as Record<string, unknown>)
				: null;
		},
		onSuccess: (_data, vars) => invalidateDetail(vars.id),
	});

	return {
		createProject: createMutation.mutate,
		createProjectAsync: createMutation.mutateAsync,
		updateProject: updateMutation.mutate,
		updateProjectAsync: updateMutation.mutateAsync,
		deleteProject: deleteMutation.mutate,
		deleteProjectAsync: deleteMutation.mutateAsync,
		addTodos: addTodosMutation.mutate,
		addTodosAsync: addTodosMutation.mutateAsync,
		removeTodo: removeTodoMutation.mutate,
		addNotes: addNotesMutation.mutate,
		addNotesAsync: addNotesMutation.mutateAsync,
		removeNote: removeNoteMutation.mutate,
		isPending:
			createMutation.isPending ||
			updateMutation.isPending ||
			deleteMutation.isPending ||
			addTodosMutation.isPending ||
			removeTodoMutation.isPending ||
			addNotesMutation.isPending ||
			removeNoteMutation.isPending,
	};
}
