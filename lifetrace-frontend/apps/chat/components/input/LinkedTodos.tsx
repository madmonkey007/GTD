import { useTranslations } from "next-intl";
import type { Todo } from "@/lib/types";

type LinkedTodosProps = {
	effectiveTodos: Todo[];
	locale: string;
	showTodosExpanded: boolean;
	onToggleExpand: () => void;
	onToggleTodo: (id: number) => void;
};

export function LinkedTodos({
	effectiveTodos,
	showTodosExpanded,
	onToggleExpand,
	onToggleTodo,
}: LinkedTodosProps) {
	const t = useTranslations("chat");
	// 没有关联待办时，不显示任何内容
	if (effectiveTodos.length === 0) {
		return null;
	}

	const previewTodos = showTodosExpanded
		? effectiveTodos
		: effectiveTodos.slice(0, 3);
	const hiddenCount = Math.max(0, effectiveTodos.length - previewTodos.length);

	return (
		<div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-border/70">
			{previewTodos.map((todo) => (
				<div
					key={todo.id}
					className="relative group inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/80 pl-3 pr-2 py-1"
				>
					<span className="text-xs text-foreground">{todo.name}</span>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onToggleTodo(todo.id);
						}}
						className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
						aria-label={t("removeLinkedTodo")}
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
						</svg>
					</button>
				</div>
			))}
			{hiddenCount > 0 && (
				<span className="text-xs text-muted-foreground">+{hiddenCount}</span>
			)}
			{effectiveTodos.length > 3 && (
				<button
					type="button"
					onClick={onToggleExpand}
					className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
				>
					{showTodosExpanded ? t("collapse") : t("expand")}
				</button>
			)}
		</div>
	);
}
