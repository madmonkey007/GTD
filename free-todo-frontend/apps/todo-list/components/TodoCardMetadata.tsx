import { Calendar, Paperclip, Tag } from "lucide-react";
import type { Todo } from "@/lib/types";
import { formatScheduleLabel } from "../utils/todoCardUtils";

interface TodoCardMetadataProps {
	todo: Todo;
}

export function TodoCardMetadata({ todo }: TodoCardMetadataProps) {
	const hasMetadata =
		todo.startTime ||
		todo.endTime ||
		(todo.attachments && todo.attachments.length > 0) ||
		(todo.tags && todo.tags.length > 0);

	if (!hasMetadata) {
		return null;
	}

	const scheduleLabel = formatScheduleLabel(todo.startTime, todo.endTime);

	return (
		<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
			{scheduleLabel && (
				<div className="flex items-center gap-1 rounded-md border border-border/20 bg-muted/15 px-2 py-0.5 text-[11px]">
					<Calendar className="h-3 w-3 text-muted-foreground/50" />
					<span>{scheduleLabel}</span>
				</div>
			)}

			{todo.attachments && todo.attachments.length > 0 && (
				<div className="flex items-center gap-1 rounded-md border border-border/20 bg-muted/15 px-2 py-0.5 text-[11px]">
					<Paperclip className="h-3 w-3 text-muted-foreground/50" />
					<span>{todo.attachments.length}</span>
				</div>
			)}

			{todo.tags && todo.tags.length > 0 && (
				<div className="flex flex-wrap items-center gap-1">
					<Tag className="h-3 w-3 text-muted-foreground/40" />
					{todo.tags.slice(0, 3).map((tag) => (
						<span
							key={tag}
							className="px-1.5 py-0.5 rounded-md bg-primary/8 text-[11px] font-medium text-primary/70 border border-primary/10"
						>
							{tag}
						</span>
					))}
					{todo.tags.length > 3 && (
						<span className="text-[11px] text-muted-foreground/50">
							+{todo.tags.length - 3}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
