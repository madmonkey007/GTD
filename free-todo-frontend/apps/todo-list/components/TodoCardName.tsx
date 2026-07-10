import type React from "react";
import type { Todo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TodoCardNameProps {
	todo: Todo;
	isEditing: boolean;
	editingName: string;
	nameInputRef: React.RefObject<HTMLInputElement | null>;
	onStartEdit: (e: React.MouseEvent) => void;
	onSave: () => void;
	onCancel: () => void;
	onChange: (value: string) => void;
}

export function TodoCardName({
	todo,
	isEditing,
	editingName,
	nameInputRef,
	onStartEdit,
	onSave,
	onCancel,
	onChange,
}: TodoCardNameProps) {
	if (isEditing) {
		return (
			<input
				ref={nameInputRef}
				type="text"
				value={editingName}
				onChange={(e) => onChange(e.target.value)}
				onBlur={onSave}
				onKeyDown={(e) => {
					e.stopPropagation();
					if (e.key === "Enter" && !e.nativeEvent.isComposing) {
						e.preventDefault();
						onSave();
					} else if (e.key === "Escape") {
						onCancel();
					}
				}}
				onMouseDown={(e) => e.stopPropagation()}
				className={cn(
					"w-full text-sm text-foreground leading-5 m-0 px-1.5 py-0.5 rounded-lg",
					"bg-background border border-border/40 focus:border-primary/40 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] focus:outline-none transition-all duration-200",
					"wrap-break-word",
				)}
			/>
		);
	}

	return (
		<div
			className={cn(
				"text-sm text-foreground leading-5 m-0 wrap-break-word line-clamp-3",
				"rounded-lg px-1.5 py-0.5",
				todo.status === "completed" && "line-through text-muted-foreground/60",
				todo.status === "canceled" && "line-through text-muted-foreground/60",
			)}
		>
			<span
				role="button"
				tabIndex={0}
				onClick={onStartEdit}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onStartEdit(e as unknown as React.MouseEvent);
					}
				}}
				className="cursor-text hover:bg-muted/20 rounded transition-colors -mx-0.5 px-0.5"
			>
				{todo.name}
			</span>
		</div>
	);
}
