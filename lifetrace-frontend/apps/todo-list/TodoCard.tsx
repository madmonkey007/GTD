"use client";

import { CSS } from "@dnd-kit/utilities";
import { Hammer, Paperclip, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useMemo, useEffect, useRef } from "react";
import { TodoContextMenu } from "@/components/common/context-menu/TodoContextMenu";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
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
	const isMobile = useIsMobile();
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const longPressTriggeredRef = useRef(false);
	const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

	const clearLongPress = () => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	};

	const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		if (!isMobile) return;
		clearLongPress();
		longPressTriggeredRef.current = false;
		const touch = e.touches[0];
		if (!touch) return;
		touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
		const target = e.currentTarget;
		longPressTimerRef.current = setTimeout(() => {
			longPressTriggeredRef.current = true;
			// 派发原生 contextmenu 事件，触发 TodoContextMenu 的 onContextMenu（React 事件委托）
			target.dispatchEvent(
				new MouseEvent("contextmenu", {
					bubbles: true,
					cancelable: true,
					clientX: touch.clientX,
					clientY: touch.clientY,
				}),
			);
		}, 500);
	};

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

	useEffect(() => {
		return () => clearLongPress();
	}, []);

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
			role="button"
			tabIndex={0}
			onClick={(e) => {
				if (longPressTriggeredRef.current) {
					longPressTriggeredRef.current = false;
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				onSelect(e);
			}}
			onTouchStart={handleTouchStart}
			onTouchEnd={() => {
				clearLongPress();
				touchStartPosRef.current = null;
			}}
			onTouchCancel={() => {
				clearLongPress();
				touchStartPosRef.current = null;
			}}
			onTouchMove={(e) => {
				if (!longPressTimerRef.current) return;
				const touch = e.touches[0];
				const start = touchStartPosRef.current;
				// 移动超过 8px（与拖拽阈值一致）则视为拖拽，取消长按
				if (
					start &&
					Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8
				) {
					clearLongPress();
				}
			}}
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
				"todo-card group relative flex max-h-32 flex-col justify-start gap-1 rounded-lg px-3 py-2 cursor-pointer",
				"transition-[background-color,box-shadow] duration-150",
				isMobile ? "bg-background" : "bg-transparent",
				"select-none",
				selected
					? "bg-primary/[0.05] dark:bg-primary/[0.08]"
					: "hover:bg-muted/50",
				isDragging && "ring-1 ring-primary/30",
			)}
			style={{
				...style,
				...(selected
					? { boxShadow: "inset 2px 0 0 0 oklch(var(--primary))" }
					: {}),
			}}
		>
			<div className="flex items-start gap-1.5">
				<div className={cn("shrink-0", isMobile ? "mt-0" : "mt-0.5")}>
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
						<TodoCardExpandButton
							hasChildren={hasChildren}
							isExpanded={isExpanded}
							onToggle={() => toggleTodoExpanded(todo.id)}
						/>
						<div
							className={cn(
								"flex items-center gap-0.5 shrink-0 self-start mt-0.5 transition-opacity duration-150",
								isMobile
									? "opacity-100"
									: "opacity-0 group-hover:opacity-100",
							)}
						>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									handlers.handleStartBreakdown();
								}}
								className={cn(
									"flex items-center justify-center rounded-md hover:bg-muted/40 transition-all",
									isMobile ? "h-9 w-9" : "h-6 w-6",
								)}
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
								className={cn(
									"flex items-center justify-center rounded-md hover:bg-muted/40 transition-all",
									isMobile ? "h-9 w-9" : "h-6 w-6",
								)}
								aria-label={tTodoDetail("getAdvice")}
								title={tTodoDetail("getAdviceTitle")}
							>
								<Sparkles className="h-3.5 w-3.5 text-primary/60" />
							</button>
						</div>

						<div className="flex items-center gap-2 shrink-0">
							{todo.attachments && todo.attachments.length > 0 && (
								<span className="flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground/60">
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
