"use client";

/**
 * Todo 列表主组件
 * 使用全局 DndContext，通过 useDndMonitor 监听拖拽事件处理内部排序
 */

import { type DragEndEvent, useDndMonitor } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, FolderKanban, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { MultiTodoContextMenu } from "@/components/common/context-menu/MultiTodoContextMenu";
import type { DragData } from "@/lib/dnd";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useProject, useProjectMutations, useTodoMutations, useTodos } from "@/lib/query";
import type { ReorderTodoItem } from "@/lib/query/todos";
import { useTodoStore } from "@/lib/store/todo-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { CreateTodoInput, Todo } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TodoFilterState } from "./components/TodoFilter";
import { useOrderedTodos } from "./hooks/useOrderedTodos";
import { NewTodoInlineForm } from "./NewTodoInlineForm";
import { TodoToolbar } from "./TodoToolbar";
import { TodoTreeList } from "./TodoTreeList";

export function TodoList() {
	const tTodoList = useTranslations("todoList");
	const tProject = useTranslations("project");
	const isMobile = useIsMobile();

	// 从侧边栏读取过滤状态
	const { sidebarMode, sidebarTag } = useUiStore();
	const specialMode = sidebarMode === "archived" || sidebarMode === "trashed";
	// 归档/回收站视图按对应筛选拉取数据（queryKey 已按 params 隔离缓存）
	const todoParams = specialMode
		? sidebarMode === "archived"
			? { archived: true }
			: { trashed: true }
		: undefined;

	// 从 TanStack Query 获取 todos 数据
	const { data: todos = [], isLoading, error } = useTodos(todoParams);

	// 从 TanStack Query 获取 mutation 操作
	const { createTodo, reorderTodos } = useTodoMutations();

	// 项目筛选（待办侧点项目后）：只展示该项目的待办成员
	const todoProjectFilter = useUiStore((s) => s.todoProjectFilter);
	const { data: filterProject } = useProject(todoProjectFilter);
	const { addTodosAsync: addTodosToProjectAsync } = useProjectMutations();
	const projectMemberIds = useMemo(() => {
		if (!todoProjectFilter || !filterProject?.todos) return null;
		return new Set(filterProject.todos.map((t) => t.id));
	}, [todoProjectFilter, filterProject]);

	// 筛选态下只保留项目成员；收集箱模式（含默认态）只展示未归入项目的待办；归档/回收站视图原样展示
	const visibleTodos = useMemo(
		() => {
			if (specialMode) return todos;
			if (projectMemberIds) {
				// 子待办随根待办保留：项目成员的完整后代链一并展示（否则多层子任务展开无内容）
				const byParent = new Map<number, number[]>();
				todos.forEach((t) => {
					const parentId = t.parentTodoId;
					if (parentId !== null && parentId !== undefined) {
						const list = byParent.get(parentId) ?? [];
						list.push(t.id);
						byParent.set(parentId, list);
					}
				});
				const visible = new Set<number>();
				const collectDescendants = (id: number) => {
					for (const childId of byParent.get(id) ?? []) {
						if (visible.has(childId)) continue;
						visible.add(childId);
						collectDescendants(childId);
					}
				};
				todos.forEach((t) => {
					if (projectMemberIds.has(t.id)) {
						visible.add(t.id);
						collectDescendants(t.id);
					}
				});
				return todos.filter((t) => visible.has(t.id));
			}
			if (sidebarMode === null || sidebarMode === 'inbox') {
				return todos.filter((t) => t.isInbox !== false);
			}
			return todos;
		},
		[todos, projectMemberIds, sidebarMode, specialMode],
	);

	// 从 Zustand 获取 UI 状态
	const {
		selectedTodoIds,
		setSelectedTodoId,
		setSelectedTodoIds,
		toggleTodoSelection,
		collapsedTodoIds,
		anchorTodoId,
		setAnchorTodoId,
	} = useTodoStore();

	const [searchQuery, setSearchQuery] = useState("");

	const [newTodoName, setNewTodoName] = useState("");
	const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
	const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
	const [filter, setFilter] = useState<TodoFilterState>({
		status: "all",
		tag: "all",
		dueTime: "all",
		hideCompleted: false,
	});

	// 将侧边栏筛选与本地 filter 合并
	const effectiveFilter = useMemo((): TodoFilterState => {
		const effective = { ...filter };

		// 侧边栏模式覆盖日期筛选
		if (sidebarMode === "today") {
			effective.dueTime = "today";
		} else if (sidebarMode === "last7days") {
			effective.dueTime = "last7Days";
		}
		// sidebarMode === "inbox" 或 null 时保持本地 filter 的 dueTime

		// 侧边栏标签覆盖标签筛选
		if (sidebarTag !== null) {
			effective.tag = sidebarTag;
		}

		return effective;
	}, [filter, sidebarMode, sidebarTag]);

	const {
		filteredTodos,
		orderedTodos,
		completedOrderedTodos,
		completedRootCount,
	} = useOrderedTodos(
		visibleTodos,
		searchQuery,
		collapsedTodoIds,
		effectiveFilter,
		specialMode,
	);

	// 处理内部排序 - 当 TODO_CARD 在列表内移动时
	const handleInternalReorder = useCallback(
		async (event: DragEndEvent) => {
			// 归档/回收站视图不支持拖拽排序
			if (specialMode) return;

			const { active, over } = event;

			if (!over || active.id === over.id) return;

			// 检查是否是 TODO_CARD 类型的拖拽
			const dragData = active.data.current as DragData | undefined;
			if (dragData?.type !== "TODO_CARD") return;

			const activeId = Number(active.id);
			const overId = Number(over.id);

			// 获取拖拽的 todo
			const activeTodo = todos.find((t: Todo) => t.id === activeId);

			if (!activeTodo) return;

			// 检查放置数据类型
			const overData = over.data.current as
				| DragData
				| { type: string; metadata?: { position?: string; todoId?: number } }
				| undefined;

			// 情况1: 拖放到 todo 上设置父子关系（通过特殊放置区域）
			if (overData?.type === "TODO_DROP_ZONE") {
				const metadata = (
					overData as { metadata?: { position?: string; todoId?: number } }
				)?.metadata;
				const position = metadata?.position;
				// 从放置区域的 metadata 中获取目标 todo ID
				const targetTodoId = metadata?.todoId;

				if (position === "nest" && targetTodoId !== undefined) {
					// 设置为子任务
					// 防止将任务设置为自己的子任务或子孙的子任务
					const isDescendant = (
						parentId: number,
						childId: number,
						allTodos: Todo[],
					): boolean => {
						let current = allTodos.find((t) => t.id === childId);
						while (current?.parentTodoId) {
							if (current.parentTodoId === parentId) return true;
							current = allTodos.find((t) => t.id === current?.parentTodoId);
						}
						return false;
					};

					if (
						activeId !== targetTodoId &&
						!isDescendant(activeId, targetTodoId, todos)
					) {
						try {
							// 获取目标父任务下的子任务
							const siblings = todos.filter(
								(t: Todo) => t.parentTodoId === targetTodoId,
							);
							// 计算新的 order
							const maxOrder = Math.max(
								0,
								...siblings.map((t: Todo) => t.order ?? 0),
							);
							const newOrder = maxOrder + 1;

							await reorderTodos([
								{
									id: activeId,
									order: newOrder,
									parentTodoId: targetTodoId,
								},
							]);
						} catch (err) {
							console.error("Failed to set parent-child relationship:", err);
						}
					}
					return;
				}
			}

			// 情况2: 常规列表内排序
			const overTodo = todos.find((t: Todo) => t.id === overId);
			if (!overTodo) return;

			const isInternalDrop = orderedTodos.some(
				({ todo }) => todo.id === overId,
			);

			if (isInternalDrop) {
				const oldIndex = orderedTodos.findIndex(
					({ todo }) => todo.id === activeId,
				);
				const newIndex = orderedTodos.findIndex(
					({ todo }) => todo.id === overId,
				);

				if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
					// 检查是否是同级排序（同一个父级）
					const isSameLevel = activeTodo.parentTodoId === overTodo.parentTodoId;

					if (isSameLevel) {
						// 同级排序：更新同级 todos 的 order
						const parentId = activeTodo.parentTodoId;
						const siblings = todos.filter(
							(t: Todo) => t.parentTodoId === parentId,
						);

						// 找到在 orderedTodos 中的索引
						const siblingIds = siblings.map((t: Todo) => t.id);
						const oldSiblingIndex = siblingIds.indexOf(activeId);
						const newSiblingIndex = siblingIds.indexOf(overId);

						if (oldSiblingIndex !== -1 && newSiblingIndex !== -1) {
							// 重新排列数组
							const reorderedSiblings = arrayMove(
								siblings,
								oldSiblingIndex,
								newSiblingIndex,
							);

							// 构建更新请求
							const reorderItems: ReorderTodoItem[] = reorderedSiblings.map(
								(todo: Todo, index: number) => ({
									id: todo.id,
									order: index,
								}),
							);

							try {
								await reorderTodos(reorderItems);
							} catch (err) {
								console.error("Failed to reorder todos:", err);
							}
						}
					} else {
						// 跨级移动：将任务移动到目标位置附近，并更新父级关系
						const newParentId = overTodo.parentTodoId;
						const newSiblings = todos.filter(
							(t: Todo) => t.parentTodoId === newParentId && t.id !== activeId,
						);

						// 找到插入位置
						const overSiblingIndex = newSiblings.findIndex(
							(t: Todo) => t.id === overId,
						);
						const insertIndex =
							overSiblingIndex !== -1 ? overSiblingIndex : newSiblings.length;

						// 在目标位置插入
						const reorderedSiblings = [...newSiblings];
						reorderedSiblings.splice(insertIndex, 0, activeTodo);

						// 构建更新请求
						const reorderItems: ReorderTodoItem[] = reorderedSiblings.map(
							(todo: Todo, index: number) => ({
								id: todo.id,
								order: index,
								...(todo.id === activeId ? { parentTodoId: newParentId } : {}),
							}),
						);

						try {
							await reorderTodos(reorderItems);
						} catch (err) {
							console.error("Failed to move todo:", err);
						}
					}
				}
			}
		},
		[orderedTodos, todos, reorderTodos, specialMode],
	);

	// 使用 useDndMonitor 监听全局拖拽事件
	useDndMonitor({
		onDragEnd: handleInternalReorder,
	});

	const handleSelect = (
		todoId: number,
		event: React.MouseEvent<HTMLDivElement>,
	) => {
		const isShift = event.shiftKey;
		const isMulti = event.metaKey || event.ctrlKey;

		// Shift 键范围选择
		if (isShift && !isMulti) {
			// 如果有锚点，进行范围选择
			if (anchorTodoId !== null) {
				// 找到锚点和当前点击的 todo 在 orderedTodos 中的索引
				const anchorIndex = orderedTodos.findIndex(
					({ todo }) => todo.id === anchorTodoId,
				);
				const currentIndex = orderedTodos.findIndex(
					({ todo }) => todo.id === todoId,
				);

				// 如果两个索引都有效
				if (anchorIndex !== -1 && currentIndex !== -1) {
					// 确定范围（从较小的索引到较大的索引）
					const startIndex = Math.min(anchorIndex, currentIndex);
					const endIndex = Math.max(anchorIndex, currentIndex);

					// 选择范围内的所有 todo
					const rangeTodoIds = orderedTodos
						.slice(startIndex, endIndex + 1)
						.map(({ todo }) => todo.id);

					setSelectedTodoIds(rangeTodoIds);
					return;
				}
			}

			// 如果没有锚点或找不到索引，只选择当前 todo 并设置为锚点
			setSelectedTodoId(todoId);
			setAnchorTodoId(todoId);
			return;
		}

		// Ctrl/Cmd 键多选
		if (isMulti && !isShift) {
			toggleTodoSelection(todoId);
			// 多选时不改变锚点，保持上一次单独点击的锚点
			return;
		}

		// 普通单击：只选择当前 todo
		setSelectedTodoId(todoId);
		setAnchorTodoId(todoId);
		// 窄屏：打开推入式整屏详情；宽屏：确保右侧详情面板打开
		if (isMobile) {
			useUiStore.getState().setMobileDetailOpen(true);
		} else {
			const { isPanelBOpen, togglePanelB } = useUiStore.getState();
			if (!isPanelBOpen) {
				togglePanelB();
			}
		}
	};

	const handleCreateTodo = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!newTodoName.trim()) return;

		const input: CreateTodoInput = {
			name: newTodoName.trim(),
		};

		try {
			const created = await createTodo(input);
			setNewTodoName("");
			setMobileComposerOpen(false);
			// 处于项目筛选态时，新代办自动归入
			const filterId = todoProjectFilter;
			if (filterId && created?.id) {
				try {
					await addTodosToProjectAsync({
						id: filterId,
						todoIds: [created.id],
					});
				} catch (attachErr) {
					console.error("Failed to attach todo to project:", attachErr);
				}
			}
		} catch (err) {
			console.error("Failed to create todo:", err);
		}
	};

	// 加载状态：与笔记列表一致的骨架行，替代跳动圆点+文案
	if (isLoading) {
		return (
			<div className="flex h-full flex-col justify-center gap-2 px-4">
				{[0, 1, 2, 3, 4].map((i) => (
					<div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
						<div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-muted" />
						<div className="flex-1 space-y-1.5">
							<div
								className="h-3 animate-pulse rounded bg-muted"
								style={{ width: `${72 - i * 9}%` }}
							/>
							<div className="h-2 animate-pulse rounded bg-muted/60 w-1/3" />
						</div>
					</div>
				))}
			</div>
		);
	}

	// 错误状态
	if (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error) || "Unknown error";
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 px-6">
				<div className="w-12 h-12 rounded-2xl bg-destructive/8 flex items-center justify-center ring-1 ring-destructive/15">
					<ChevronRight className="w-6 h-6 text-destructive/60 rotate-90" />
				</div>
				<p className="text-xs text-muted-foreground/70 leading-relaxed text-center max-w-[280px]">
					{tTodoList("loadFailed", { error: errorMessage })}
				</p>
			</div>
		);
	}

	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-background dark:bg-background">
			<TodoToolbar
				searchQuery={searchQuery}
				onSearch={setSearchQuery}
				todos={todos}
				filter={filter}
				onFilterChange={setFilter}
				projectFilter={filterProject ?? null}
				specialMode={specialMode}
			/>

			<MultiTodoContextMenu selectedTodoIds={selectedTodoIds}>
				<div
					className={cn(
						"flex-1 overflow-y-auto",
						isMobile && "bg-muted/40",
					)}
				>
					<div className="flex min-h-full flex-col">
					{!isMobile && !specialMode && (
						<div className="px-6 py-4 pb-4">
							<NewTodoInlineForm
								value={newTodoName}
								onChange={setNewTodoName}
								onSubmit={handleCreateTodo}
								onCancel={() => setNewTodoName("")}
							/>
						</div>
					)}

					{filteredTodos.length === 0 ? (
						specialMode ? (
							<div className="flex h-[200px] items-center justify-center px-4 text-sm text-muted-foreground">
								{tTodoList(sidebarMode === "archived" ? "noArchived" : "noTrashed")}
							</div>
						) : todoProjectFilter ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 ring-1 ring-primary/10">
									<FolderKanban className="h-5 w-5 text-primary/50" />
								</div>
								<p className="text-sm text-muted-foreground">
									{tProject("emptyTodos")}
								</p>
								<p className="text-xs text-muted-foreground/60">
									{tProject("emptyTodosHint")}
								</p>
							</div>
						) : (
							<div className="flex h-[200px] items-center justify-center px-4 text-sm text-muted-foreground">
								{tTodoList("noTodos")}
							</div>
						)
					) : (
						<>
							{orderedTodos.length > 0 && (
								<TodoTreeList
									orderedTodos={orderedTodos}
									selectedTodoIds={selectedTodoIds}
									onSelect={handleSelect}
									onSelectSingle={(id) => setSelectedTodoId(id)}
								/>
							)}
							{!specialMode && filter.status === "all" && completedRootCount > 0 && (
								<div className="px-6 pb-6">
									<button
										type="button"
										onClick={() => setIsCompletedCollapsed((prev) => !prev)}
										className="flex w-full items-center justify-between rounded-xl border border-dashed border-border/50 bg-muted/[0.03] px-4 py-2.5 text-sm text-muted-foreground/70 hover:bg-muted/10 hover:text-foreground transition-all duration-200"
									>
										<span className="flex items-center gap-2 font-medium">
											{tTodoList("statusCompleted")}
										</span>
										<span className="flex items-center gap-1.5">
											<span className="text-xs text-muted-foreground/40">
												{completedRootCount}
											</span>
											<ChevronRight
												className={cn(
													"h-4 w-4 text-muted-foreground/50 transition-transform",
													!isCompletedCollapsed && "rotate-90",
												)}
											/>
										</span>
									</button>
									{!isCompletedCollapsed &&
										completedOrderedTodos.length > 0 && (
											<TodoTreeList
												orderedTodos={completedOrderedTodos}
												selectedTodoIds={selectedTodoIds}
												onSelect={handleSelect}
												onSelectSingle={(id) => setSelectedTodoId(id)}
											/>
										)}
								</div>
							)}
						</>
						)}
					</div>
				</div>
			</MultiTodoContextMenu>

			{isMobile && (
				<>
					<AnimatePresence>
						{mobileComposerOpen && (
							<>
								<motion.div
									className="absolute inset-0 z-40 bg-black/30"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
									onClick={() => setMobileComposerOpen(false)}
								/>
								<motion.div
									className="absolute inset-x-0 bottom-0 z-40"
									initial={{ y: "100%" }}
									animate={{ y: 0 }}
									exit={{ y: "100%" }}
									transition={{ type: "spring", damping: 30, stiffness: 300 }}
									style={{
										paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
									}}
								>
									<div className="border-t border-border/40 bg-background px-4 pt-3 pb-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.3)]">
										<NewTodoInlineForm
											value={newTodoName}
											onChange={setNewTodoName}
											onSubmit={handleCreateTodo}
											onCancel={() => setNewTodoName("")}
											showSubmit
										/>
									</div>
								</motion.div>
							</>
						)}
					</AnimatePresence>

					{!mobileComposerOpen && !specialMode && (
						<motion.button
							type="button"
							onClick={() => setMobileComposerOpen(true)}
							aria-label="新建待办"
							initial={{ scale: 0, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0, opacity: 0 }}
							transition={{ type: "spring", stiffness: 300, damping: 22 }}
							className="absolute right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_rgba(0,0,0,0.4)] transition-transform active:scale-95"
							style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
						>
							<Plus className="h-6 w-6" />
						</motion.button>
					)}
				</>
			)}
		</div>
	);
}
