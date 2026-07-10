"use client";

import { CSS } from "@dnd-kit/utilities";
import { Hammer, Paperclip, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useMemo } from "react";
import { TodoContextMenu } from "@/components/common/context-menu/TodoContextMenu";
import { useTodos } from "@/lib/query";
import { useTodoStore } from "@/lib/store/todo-store";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TodoCardCheckbox } from "./components/TodoCardCheckbox";
import { TodoCardChildForm } from "./components/TodoCardChildForm";
import { TodoCardDropZone } from "./components/TodoCardDropZone";
import { TodoCardExpandButton } from "./components/TodoCardExpandButton";
import { TodoCardMetadata } from "./components/TodoCardMetadata";
import { TodoCardName } from "./components/TodoCardName";
import { useTodoCardDrag } from "./hooks/useTodoCardDrag";
import { useTodoCardHandlers } from "./hooks/useTodoCardHandlers";
import { useTodoCardState } from "./hooks/useTodoCardState";

export interface TodoCardProps {
	todo: Todo;
	depth?: number;
	isDragging?: boolean;
	selected?: boolean;
	isOverlay?: boolean;
	hasMultipleSelection?: boolean;
	onSelect: (e: React.MouseEvent<HTMLDivElement>) => void;
	onSelectSingle: () => void;
}

export function TodoCard({
	todo,
	depth = 0,
	isDragging,
	selected,
	isOverlay,
	hasMultipleSelection = false,
	onSelect,
	onSelectSingle,
}: TodoCardProps) {
	const tTodoDetail = useTranslations("todoDetail");
	const { data: todos = [] } = useTodos();
	const { toggleTodoExpanded, isTodoExpanded } = useTodoStore();

	const state = useTodoCardState(todo);
	const drag = useTodoCardDrag({ todo, depth, isOverlay: isOverlay ?? false });
	const handlers = useTodoCardHandlers({
		todo,
		setIsAddingChild: state.setIsAddingChild,
		childName: state.childName,
		setChildName: state.setChildName,
		setIsEditingName: state.setIsEditingName,
		editingName: state.editingName,
		setEditingName: state.setEditingName,
	});

	const hasChildren = useMemo(() => {
		return todos.some((t: Todo) => t.parentTodoId === todo.id);
	}, [todos, todo.id]);

	const isExpanded = isTodoExpanded(todo.id);

	const style = !isOverlay
		? {
				transform: CSS.Transform.toString(drag.transform),
				transition: drag.isSortableDragging ? "none" : drag.transition,
				opacity: drag.isSortableDragging ? 0.5 : 1,
			}
		: undefined;

	const cardContent = (
		<div
			{...(!isOverlay ? { ...drag.attributes, ...drag.listeners } : {})}
			ref={drag.setNodeRef}
			style={style}
			role="button"
			tabIndex={0}
			onClick={onSelect}
			onMouseDown={(e) => {
				if (e.shiftKey || e.metaKey || e.ctrlKey) {
					e.preventDefault();
				}
			}}
			data-state={selected ? "selected" : "default"}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelectSingle();
				}
			}}
			className={cn(
				"todo-card group relative flex max-h-32 flex-col justify-start gap-1 rounded-xl px-3 py-2.5 cursor-pointer",
				"border transition-all duration-200",
				"bg-card dark:bg-background",
				"select-none",
				selected
					? "bg-primary/[0.03] border-primary/20 dark:border-primary/25"
					: "border-transparent hover:border-border/30 hover:bg-muted/[0.02]",
				isDragging && "ring-2 ring-primary/20",
			)}
		>
			<div className="flex items-start gap-1.5">
				<TodoCardExpandButton
					hasChildren={hasChildren}
					isExpanded={isExpanded}
					onToggle={() => toggleTodoExpanded(todo.id)}
				/>

				<div className="mt-0.5">
					<TodoCardCheckbox
						todo={todo}
						onToggle={handlers.handleToggleStatus}
					/>
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0 flex-1">
							<TodoCardName
								todo={todo}
								isEditing={state.isEditingName}
								editingName={state.editingName}
								nameInputRef={state.nameInputRef}
								onStartEdit={handlers.handleStartEditName}
								onSave={handlers.handleSaveName}
								onCancel={handlers.handleCancelEditName}
								onChange={state.setEditingName}
							/>
						</div>
						<div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 self-start mt-0.5 transition-opacity duration-150">
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handlers.handleStartBreakdown();
								}}
								className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted/40 transition-all"
								aria-label={tTodoDetail("useAiPlan")}
								title={tTodoDetail("useAiPlanTitle")}
							>
								<Hammer className="h-3.5 w-3.5 text-primary/60" />
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handlers.handleGetAdvice();
								}}
								className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted/40 transition-all"
								aria-label={tTodoDetail("getAdvice")}
								title={tTodoDetail("getAdviceTitle")}
							>
								<Sparkles className="h-3.5 w-3.5 text-amber-500/70" />
							</button>
						</div>

						<div className="flex items-center gap-2 shrink-0">
							{todo.attachments && todo.attachments.length > 0 && (
								<span className="flex items-center gap-1 rounded-md border border-border/30 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 bg-muted/20">
									<Paperclip className="h-3 w-3" />
									{todo.attachments.length}
								</span>
							)}
						</div>
					</div>

					<TodoCardMetadata todo={todo} />
				</div>
			</div>

			{state.isAddingChild && (
				<TodoCardChildForm
					childName={state.childName}
					childInputRef={state.childInputRef}
					onChange={state.setChildName}
					onSubmit={handlers.handleCreateChild}
					onCancel={() => {
						state.setIsAddingChild(false);
						state.setChildName("");
					}}
				/>
			)}

			{drag.showNestDropZone && (
				<TodoCardDropZone droppable={drag.nestDroppable} />
			)}
		</div>
	);

	if (isOverlay) {
		return cardContent;
	}

	if (hasMultipleSelection) {
		return cardContent;
	}

	return (
		<TodoContextMenu
			todoId={todo.id}
			onAddChild={handlers.handleAddChildFromMenu}
			onContextMenuOpen={onSelectSingle}
		>
			{cardContent}
		</TodoContextMenu>
	);
}
