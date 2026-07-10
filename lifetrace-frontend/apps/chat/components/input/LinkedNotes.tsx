import { useNoteChatStore } from "@/lib/store/note-chat-store";

type LinkedNotesProps = {
	locale: string;
};

export function LinkedNotes({ locale }: LinkedNotesProps) {
	const linkedNotes = useNoteChatStore((s) => s.linkedNotes);
	const removeLinkedNote = useNoteChatStore((s) => s.removeLinkedNote);

	if (linkedNotes.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-border/70">
			{linkedNotes.map((note) => (
				<div
					key={note.id}
					className="relative group inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/80 pl-3 pr-2 py-1"
				>
					<span className="text-xs text-foreground truncate max-w-[150px]">
						{note.name || (locale === "zh" ? "未命名笔记" : "Untitled note")}
					</span>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							removeLinkedNote(note.id);
						}}
						className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
						aria-label={locale === "zh" ? "移除笔记" : "Remove note"}
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
						</svg>
					</button>
				</div>
			))}
		</div>
	);
}
