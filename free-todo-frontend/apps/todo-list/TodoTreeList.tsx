"use client";

import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type React from "react";
import { motion } from "framer-motion";
import { useGlobalDndSafe } from "@/lib/dnd";
import type { OrderedTodo } from "./hooks/useOrderedTodos";
import { TodoCard } from "./TodoCard";

interface TodoTreeListProps {
	orderedTodos: OrderedTodo[];
	selectedTodoIds: number[];
	onSelect: (todoId: number, event: React.MouseEvent<HTMLDivElement>) => void;
	onSelectSingle: (todoId: number) => void;
}

export function TodoTreeList({
	orderedTodos,
	selectedTodoIds,
	onSelect,
	onSelectSingle,
}: TodoTreeListProps) {
	const dndContext = useGlobalDndSafe();
	const activeId = dndContext?.activeDrag?.id ?? null;

	return (
		<SortableContext
			items={orderedTodos.map(({ todo }) => todo.id)}
			strategy={verticalListSortingStrategy}
		>
			<div className="px-4 pb-4 flex flex-col gap-px">
				{orderedTodos.map(({ todo, depth }, index) => (
					<motion.div
						key={todo.id}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							duration: 0.25,
							delay: index * 0.02,
							ease: [0.16, 1, 0.3, 1],
						}}
						style={{ marginLeft: depth * 16 }}
						className={depth > 0 ? "relative" : undefined}
					>
						<TodoCard
							todo={todo}
							depth={depth}
							isDragging={activeId === todo.id}
							selected={selectedTodoIds.includes(todo.id)}
							hasMultipleSelection={selectedTodoIds.length > 1}
							onSelect={(event) => onSelect(todo.id, event)}
							onSelectSingle={() => onSelectSingle(todo.id)}
						/>
					</motion.div>
				))}
			</div>
		</SortableContext>
	);
}
