"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isOfflineError } from "@/lib/api/fetcher";
import {
	createTodoApiTodosPost,
	deleteTodoApiTodosTodoIdDelete,
	listTodosApiTodosGet,
	purgeTodoApiTodosTodoIdPurgeDelete,
	reorderTodosApiTodosReorderPost,
	restoreTodoApiTodosTodoIdRestorePost,
	updateTodoApiTodosTodoIdPut,
	useListTodosApiTodosGet,
} from "@/lib/generated/todos/todos";
import { listMirrorEntities } from "@/lib/offline/db";
import { saveServerList } from "@/lib/offline/mirror";
import {
	isOffline,
	offlineCreateTodo,
	offlineDeleteTodo,
	offlineUpdateTodo,
	saveTodoToMirror,
} from "@/lib/offline/writes";
import type {
	CreateTodoInput,
	Todo,
	TodoListResponse,
	TodoPriority,
	TodoStatus,
	UpdateTodoInput,
} from "@/lib/types";
import { queryKeys } from "./keys";

// ============================================================================
// Helper Functions
// ============================================================================

const normalizePriority = (priority: unknown): TodoPriority => {
	if (priority === "high" || priority === "medium" || priority === "low") {
		return priority;
	}
	return "none";
};

const normalizeStatus = (status: unknown): TodoStatus => {
	if (status === "completed" || status === "canceled" || status === "draft")
		return status;
	return "active";
};

function normalizeDateTimeValue(
	value?: string | null,
): string | null | undefined {
	// undefined 表示不更新；null 表示显式清空
	if (value === undefined) return undefined;
	if (value === null) return null;
	// 兼容 <input type="date"> 的 YYYY-MM-DD（后端期望 datetime）
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return `${value}T00:00:00`;
	}
	return value;
}

/**
 * Normalize API response to ensure consistent Todo type
 * Now that fetcher auto-converts snake_case -> camelCase, we just need to normalize some optional fields
 */
export function normalizeTodo(raw: Record<string, unknown>): Todo {
	return {
		id: raw.id as number,
		name: raw.name as string,
		summary: (raw.summary as string) ?? undefined,
		description: (raw.description as string) ?? undefined,
		userNotes: (raw.userNotes as string) ?? undefined,
		status: normalizeStatus(raw.status),
		priority: normalizePriority(raw.priority),
		itemType: (raw.itemType as string) ?? undefined,
		location: (raw.location as string) ?? undefined,
		categories: (raw.categories as string) ?? undefined,
		classification: (raw.classification as string) ?? undefined,
		deadline: (raw.deadline as string) ?? undefined,
		startTime: (raw.startTime as string) ?? undefined,
		endTime: (raw.endTime as string) ?? undefined,
		dtstart: (raw.dtstart as string) ?? undefined,
		dtend: (raw.dtend as string) ?? undefined,
		due: (raw.due as string) ?? undefined,
		duration: (raw.duration as string) ?? undefined,
		timeZone: (raw.timeZone as string) ?? undefined,
		tzid: (raw.tzid as string) ?? undefined,
		isAllDay: (raw.isAllDay as boolean) ?? undefined,
		dtstamp: (raw.dtstamp as string) ?? undefined,
		created: (raw.created as string) ?? undefined,
		lastModified: (raw.lastModified as string) ?? undefined,
		sequence: (raw.sequence as number) ?? undefined,
		rdate: (raw.rdate as string) ?? undefined,
		exdate: (raw.exdate as string) ?? undefined,
		recurrenceId: (raw.recurrenceId as string) ?? undefined,
		relatedToUid: (raw.relatedToUid as string) ?? undefined,
		relatedToReltype: (raw.relatedToReltype as string) ?? undefined,
		icalStatus: (raw.icalStatus as string) ?? undefined,
		reminderOffsets: (raw.reminderOffsets as number[] | null) ?? undefined,
		rrule: (raw.rrule as string | null) ?? undefined,
		order: (raw.order as number) ?? 0,
		isInbox: (raw.isInbox as boolean) ?? true,
		isArchived: (raw.isArchived as boolean) ?? false,
		isTrashed: (raw.isTrashed as boolean) ?? false,
		trashedAt: (raw.trashedAt as string | null) ?? null,
		tags: (raw.tags as string[]) ?? [],
		attachments: (raw.attachments as Todo["attachments"]) ?? [],
		parentTodoId:
			raw.parentTodoId === null || raw.parentTodoId === undefined
				? null
				: (raw.parentTodoId as number),
		relatedActivities: (raw.relatedActivities as number[]) ?? [],
		completedAt: (raw.completedAt as string) ?? undefined,
		percentComplete: (raw.percentComplete as number) ?? undefined,
		createdAt: raw.createdAt as string,
		updatedAt: raw.updatedAt as string,
	};
}

// ============================================================================
// Query Hooks
// ============================================================================

interface UseTodosParams {
	status?: string;
	limit?: number;
	offset?: number;
	archived?: boolean;
	trashed?: boolean;
}

/**
 * 获取 Todo 列表的 Query Hook
 * 使用 Orval 生成的 hook；queryFn 包了一层离线逻辑：
 * 成功 → 写入 IndexedDB 镜像；网络失败 → 返回镜像数据（含离线创建的行）
 */
export function useTodos(params?: UseTodosParams) {
	const requestParams = {
		limit: params?.limit ?? 2000,
		offset: params?.offset ?? 0,
		status: params?.status,
		archived: params?.archived,
		trashed: params?.trashed,
	};

	return useListTodosApiTodosGet(requestParams, {
		query: {
			queryKey: queryKeys.todos.list(params),
			staleTime: 30 * 1000, // 30 秒内数据被认为是新鲜的
			queryFn: async ({ signal }) => {
				try {
					const res = await listTodosApiTodosGet(requestParams, { signal });
					const response = res as unknown as TodoListResponse;
					const rows = (response?.todos ?? []) as unknown as Record<
						string,
						unknown
					>[];
					await saveServerList(
						"todo",
						"todo",
						rows.map((raw) => ({
							...normalizeTodo(raw),
							uid: (raw.uid as string) ?? `srv-${raw.id}`,
						})),
					);
					return res;
				} catch (err) {
					if (isOfflineError(err)) {
						const mirrorRows = await listMirrorEntities<
							Record<string, unknown>
						>("todo");
						return { todos: mirrorRows, total: mirrorRows.length } as unknown as Awaited<
							ReturnType<typeof listTodosApiTodosGet>
						>;
					}
					throw err;
				}
			},
			select: (data: unknown) => {
				// Data is now auto-converted to camelCase by the fetcher
				const response = data as TodoListResponse;
				const todos = response?.todos ?? [];
				return todos.map((raw) =>
					normalizeTodo(raw as unknown as Record<string, unknown>),
				);
			},
		},
	});
}

// ============================================================================
// Mutation Hooks
// ============================================================================

// 防抖更新相关的全局状态
const pendingUpdateTimers = new Map<number, ReturnType<typeof setTimeout>>();
const pendingUpdatePayloads = new Map<number, UpdateTodoInput>();

// 在线更新 + 断网时转入离线队列；rawInput 为 camelCase 原始字段（镜像合并用）
async function executeTodoUpdate(
	id: number,
	payload: Record<string, unknown>,
	rawInput: UpdateTodoInput,
): Promise<Todo> {
	if (isOffline()) {
		return offlineUpdateTodo(id, rawInput as Record<string, unknown>) as unknown as Todo;
	}
	try {
		const updated = await updateTodoApiTodosTodoIdPut(id, payload as never);
		await saveTodoToMirror(updated as unknown as Record<string, unknown>);
		return normalizeTodo(updated as unknown as Record<string, unknown>);
	} catch (err) {
		if (isOfflineError(err)) {
			return offlineUpdateTodo(
				id,
				rawInput as Record<string, unknown>,
			) as unknown as Todo;
		}
		throw err;
	}
}

/**
 * 创建 Todo 的 Mutation Hook
 */
export function useCreateTodo() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: CreateTodoInput) => {
			// Fetcher will auto-convert camelCase -> snake_case for request
			// and snake_case -> camelCase for response
			const payload = {
				name: input.name,
				summary: input.summary,
				description: input.description,
				userNotes: input.userNotes,
				parentTodoId: input.parentTodoId ?? null,
				itemType: input.itemType,
				location: input.location,
				categories: input.categories,
				classification: input.classification,
				deadline: normalizeDateTimeValue(input.deadline),
				startTime: normalizeDateTimeValue(input.startTime),
				endTime: normalizeDateTimeValue(input.endTime),
				dtstart: normalizeDateTimeValue(input.dtstart),
				dtend: normalizeDateTimeValue(input.dtend),
				due: normalizeDateTimeValue(input.due),
				duration: input.duration,
				timeZone: input.timeZone,
				tzid: input.tzid,
				isAllDay: input.isAllDay,
				dtstamp: normalizeDateTimeValue(input.dtstamp),
				created: normalizeDateTimeValue(input.created),
				lastModified: normalizeDateTimeValue(input.lastModified),
				sequence: input.sequence,
				rdate: input.rdate,
				exdate: input.exdate,
				recurrenceId: normalizeDateTimeValue(input.recurrenceId),
				relatedToUid: input.relatedToUid,
				relatedToReltype: input.relatedToReltype,
				icalStatus: input.icalStatus,
				reminderOffsets: input.reminderOffsets,
				rrule: input.rrule,
				status: input.status ?? "active",
				priority: input.priority ?? "none",
				completedAt: normalizeDateTimeValue(input.completedAt),
				percentComplete: input.percentComplete,
				order: input.order ?? 0,
				tags: input.tags ?? [],
				relatedActivities: input.relatedActivities ?? [],
			};
			const created = await (async () => {
				if (isOffline()) {
					return offlineCreateTodo(payload as Record<string, unknown>);
				}
				try {
					const res = await createTodoApiTodosPost(payload as never);
					await saveTodoToMirror(res as unknown as Record<string, unknown>);
					return res as unknown as Record<string, unknown>;
				} catch (err) {
					if (isOfflineError(err)) {
						return offlineCreateTodo(payload as Record<string, unknown>);
					}
					throw err;
				}
			})();
			return normalizeTodo(created as Record<string, unknown>);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
		},
	});
}

interface UpdateTodoParams {
	id: number;
	input: UpdateTodoInput;
}

/**
 * 更新 Todo 的 Mutation Hook
 * 支持乐观更新和防抖（针对描述和备注字段）
 */
export function useUpdateTodo() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ id, input }: UpdateTodoParams) => {
			const keys = Object.keys(input);
			const shouldDebounce =
				keys.length > 0 &&
				keys.every((k) => k === "description" || k === "userNotes");

			// 合并同一 todo 的待发送 payload
			const merged: UpdateTodoInput = {
				...(pendingUpdatePayloads.get(id) ?? {}),
				...input,
			};
			pendingUpdatePayloads.set(id, merged);

			// 如果需要防抖，返回一个 Promise 延迟执行
			if (shouldDebounce) {
				return new Promise<Todo>((resolve, reject) => {
					const existingTimer = pendingUpdateTimers.get(id);
					if (existingTimer) clearTimeout(existingTimer);

					const timer = setTimeout(async () => {
						pendingUpdateTimers.delete(id);
						const body = pendingUpdatePayloads.get(id);
						pendingUpdatePayloads.delete(id);
						if (!body || Object.keys(body).length === 0) {
							const cachedData = queryClient.getQueryData<TodoListResponse>(
								queryKeys.todos.list(),
							);
							const todos = cachedData?.todos ?? [];
							const todo = todos.find((t) => t.id === id);
							if (todo) {
								resolve(todo);
							} else {
								reject(new Error("Todo not found"));
							}
							return;
						}

						try {
							// Build payload with normalized date/time inputs
							const payload = {
								...body,
								deadline: normalizeDateTimeValue(body.deadline),
								startTime: normalizeDateTimeValue(body.startTime),
								endTime: normalizeDateTimeValue(body.endTime),
								dtstart: normalizeDateTimeValue(body.dtstart),
								dtend: normalizeDateTimeValue(body.dtend),
								due: normalizeDateTimeValue(body.due),
								dtstamp: normalizeDateTimeValue(body.dtstamp),
								created: normalizeDateTimeValue(body.created),
								lastModified: normalizeDateTimeValue(body.lastModified),
								recurrenceId: normalizeDateTimeValue(body.recurrenceId),
								completedAt: normalizeDateTimeValue(body.completedAt),
								rrule: body.rrule,
							};
							resolve(
								await executeTodoUpdate(id, payload as Record<string, unknown>, body),
							);
						} catch (err) {
							reject(err);
						}
					}, 500);
					pendingUpdateTimers.set(id, timer);
				});
			}

			// 非防抖字段立即更新
			const body = pendingUpdatePayloads.get(id);
			pendingUpdatePayloads.delete(id);
			if (!body || Object.keys(body).length === 0) {
				throw new Error("No fields to update");
			}

			// Build payload with normalized date/time inputs
			const payload = {
				...body,
				deadline: normalizeDateTimeValue(body.deadline),
				startTime: normalizeDateTimeValue(body.startTime),
				endTime: normalizeDateTimeValue(body.endTime),
				dtstart: normalizeDateTimeValue(body.dtstart),
				dtend: normalizeDateTimeValue(body.dtend),
				due: normalizeDateTimeValue(body.due),
				dtstamp: normalizeDateTimeValue(body.dtstamp),
				created: normalizeDateTimeValue(body.created),
				lastModified: normalizeDateTimeValue(body.lastModified),
				recurrenceId: normalizeDateTimeValue(body.recurrenceId),
				completedAt: normalizeDateTimeValue(body.completedAt),
				rrule: body.rrule,
			};
			return executeTodoUpdate(id, payload as Record<string, unknown>, body);
		},
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.todos.all });

			const previousData = queryClient.getQueryData<TodoListResponse>(
				queryKeys.todos.list(),
			);

			// 乐观更新
			queryClient.setQueryData(
				queryKeys.todos.list(),
				(old: TodoListResponse | undefined) => {
					if (!old || !old.todos) return old;
					const updatedTodos = old.todos.map((todo) => {
						if (todo.id === id) {
							return {
								...todo,
								...input,
								priority: normalizePriority(input.priority ?? todo.priority),
								status: normalizeStatus(input.status ?? todo.status),
								updatedAt: new Date().toISOString(),
							};
						}
						return todo;
					});
					return { ...old, todos: updatedTodos };
				},
			);

			return { previousData };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeys.todos.list(), context.previousData);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
		},
	});
}

/**
 * 删除 Todo 的 Mutation Hook
 */
export function useDeleteTodo() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: number) => {
			if (isOffline()) return offlineDeleteTodo(id);
			try {
				await deleteTodoApiTodosTodoIdDelete(id);
				return id;
			} catch (err) {
				if (isOfflineError(err)) return offlineDeleteTodo(id);
				throw err;
			}
		},
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.todos.all });

			const previousData = queryClient.getQueryData<TodoListResponse>(
				queryKeys.todos.list(),
			);

			const previousTodos = previousData?.todos ?? [];

			// 递归查找所有子任务 ID
			const findAllChildIds = (
				parentId: number,
				allTodos: Todo[],
			): number[] => {
				const childIds: number[] = [];
				const children = allTodos.filter((t) => t.parentTodoId === parentId);
				for (const child of children) {
					childIds.push(child.id);
					childIds.push(...findAllChildIds(child.id, allTodos));
				}
				return childIds;
			};

			const allIdsToDelete = [id, ...findAllChildIds(id, previousTodos)];
			const idsToDeleteSet = new Set(allIdsToDelete);

			// 乐观更新
			queryClient.setQueryData(
				queryKeys.todos.list(),
				(old: TodoListResponse | undefined) => {
					if (!old || !old.todos) return old;
					const updatedTodos = old.todos.filter(
						(todo) => !idsToDeleteSet.has(todo.id),
					);
					return {
						...old,
						todos: updatedTodos,
						total: updatedTodos.length,
					};
				},
			);

			return { previousData, deletedIds: allIdsToDelete };
		},
		onError: (_err, _id, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeys.todos.list(), context.previousData);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
		},
	});
}

/**
 * 切换 Todo 状态的 Mutation Hook
 */
export function useToggleTodoStatus() {
	const queryClient = useQueryClient();
	const updateMutation = useUpdateTodo();

	return useMutation({
		mutationFn: async (id: number) => {
			const cachedData = queryClient.getQueryData<TodoListResponse>(
				queryKeys.todos.list(),
			);
			const todos = cachedData?.todos ?? [];
			const todo = todos.find((t) => t.id === id);
			if (!todo) throw new Error("Todo not found");

			const nextStatus: TodoStatus =
				todo.status === "completed"
					? "active"
					: todo.status === "canceled"
						? "canceled"
						: todo.status === "draft"
							? "active"
							: "completed";

			return updateMutation.mutateAsync({ id, input: { status: nextStatus } });
		},
	});
}

/**
 * 重排序参数
 */
export interface ReorderTodoItem {
	id: number;
	order: number;
	parentTodoId?: number | null;
}

/**
 * 批量重排序 Todo 的 Mutation Hook
 */
export function useReorderTodos() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (items: ReorderTodoItem[]) => {
			// 排序的 order 重放在 v1 不支持离线，离线时直接失败回滚乐观更新
			if (isOffline()) {
				throw new Error("离线暂不支持排序，联网后再试");
			}
			// Fetcher will auto-convert camelCase -> snake_case
			return reorderTodosApiTodosReorderPost({ items } as never);
		},
		onMutate: async (items) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.todos.all });

			const previousData = queryClient.getQueryData<TodoListResponse>(
				queryKeys.todos.list(),
			);

			// 乐观更新
			queryClient.setQueryData(
				queryKeys.todos.list(),
				(old: TodoListResponse | undefined) => {
					if (!old || !old.todos) return old;
					const updatedTodos = old.todos.map((todo) => {
						const item = items.find((i) => i.id === todo.id);
						if (item) {
							return {
								...todo,
								order: item.order,
								...(item.parentTodoId !== undefined
									? { parentTodoId: item.parentTodoId }
									: {}),
								updatedAt: new Date().toISOString(),
							};
						}
						return todo;
					});
					return { ...old, todos: updatedTodos };
				},
			);

			return { previousData };
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeys.todos.list(), context.previousData);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
		},
	});
}

// ============================================================================
// 组合 Hook：提供完整的 Todo 操作能力
// ============================================================================

/**
 * 从回收站恢复 Todo 的 Mutation Hook
 */
export function useRestoreTodo() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: number) => {
			await restoreTodoApiTodosTodoIdRestorePost(id);
			return id;
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
		},
	});
}

/**
 * 彻底删除 Todo（回收站永久删除）的 Mutation Hook
 */
export function usePurgeTodo() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: number) => {
			await purgeTodoApiTodosTodoIdPurgeDelete(id);
			return id;
		},
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.todos.all });

			const previousData = queryClient.getQueryData<TodoListResponse>(
				queryKeys.todos.list(),
			);

			const previousTodos = previousData?.todos ?? [];

			// 递归查找所有子任务 ID
			const findAllChildIds = (
				parentId: number,
				allTodos: Todo[],
			): number[] => {
				const childIds: number[] = [];
				const children = allTodos.filter((t) => t.parentTodoId === parentId);
				for (const child of children) {
					childIds.push(child.id);
					childIds.push(...findAllChildIds(child.id, allTodos));
				}
				return childIds;
			};

			const allIdsToDelete = [id, ...findAllChildIds(id, previousTodos)];
			const idsToDeleteSet = new Set(allIdsToDelete);

			// 乐观更新：从缓存中移除待删除项
			queryClient.setQueryData(
				queryKeys.todos.list(),
				(old: TodoListResponse | undefined) => {
					if (!old || !old.todos) return old;
					const updatedTodos = old.todos.filter(
						(todo) => !idsToDeleteSet.has(todo.id),
					);
					return {
						...old,
						todos: updatedTodos,
						total: updatedTodos.length,
					};
				},
			);

			return { previousData };
		},
		onError: (_err, _id, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeys.todos.list(), context.previousData);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.todos.all });
		},
	});
}

/**
 * 提供所有 Todo Mutation 操作的组合 Hook
 */
export function useTodoMutations() {
	const createMutation = useCreateTodo();
	const updateMutation = useUpdateTodo();
	const deleteMutation = useDeleteTodo();
	const toggleStatusMutation = useToggleTodoStatus();
	const reorderMutation = useReorderTodos();
	const restoreMutation = useRestoreTodo();
	const purgeMutation = usePurgeTodo();

	return {
		createTodo: createMutation.mutateAsync,
		updateTodo: (id: number, input: UpdateTodoInput) =>
			updateMutation.mutateAsync({ id, input }),
		deleteTodo: deleteMutation.mutateAsync,
		toggleTodoStatus: toggleStatusMutation.mutateAsync,
		reorderTodos: reorderMutation.mutateAsync,
		restoreTodo: restoreMutation.mutateAsync,
		purgeTodo: purgeMutation.mutateAsync,
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
		isReordering: reorderMutation.isPending,
		isRestoring: restoreMutation.isPending,
		isPurging: purgeMutation.isPending,
		createError: createMutation.error,
		updateError: updateMutation.error,
		deleteError: deleteMutation.error,
		reorderError: reorderMutation.error,
		restoreError: restoreMutation.error,
		purgeError: purgeMutation.error,
	};
}
