"use client";

import { CheckSquare, Inbox, SquarePen, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useJournalMutations, useTodoMutations } from "@/lib/query";
import { useQuickCapture, type QuickCaptureType } from "@/lib/store/quick-capture-store";
import { normalizeDateOnly } from "@/apps/diary/journal-utils";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function toDateString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

const typeConfig: Record<
	QuickCaptureType,
	{ icon: typeof SquarePen; titleKey: "noteTitle" | "todoTitle" | "inboxTitle"; placeholderKey: "notePlaceholder" | "todoPlaceholder" | "inboxPlaceholder" }
> = {
	note: { icon: SquarePen, titleKey: "noteTitle", placeholderKey: "notePlaceholder" },
	todo: { icon: CheckSquare, titleKey: "todoTitle", placeholderKey: "todoPlaceholder" },
	inbox: { icon: Inbox, titleKey: "inboxTitle", placeholderKey: "inboxPlaceholder" },
};

export function QuickCaptureModal() {
	const t = useTranslations("quickCapture");
	const isOpen = useQuickCapture((s) => s.isOpen);
	const captureType = useQuickCapture((s) => s.captureType);
	const close = useQuickCapture((s) => s.close);
	const { createJournal } = useJournalMutations();
	const { createTodo } = useTodoMutations();

	const [text, setText] = useState("");
	const [saving, setSaving] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		if (isOpen) {
			setText("");
			setSaving(false);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isOpen, captureType]);

	const handleSubmit = async () => {
		const value = text.trim();
		if (!value || saving) return;
		setSaving(true);
		try {
			if (captureType === "note") {
				await createJournal({
					user_notes: value,
					date: toDateString(normalizeDateOnly(new Date())),
					content_format: "markdown",
				});
				toast(t("noteSaved"));
			} else {
				await createTodo({ name: value, isInbox: captureType === "inbox" });
				toast(t(captureType === "inbox" ? "inboxSaved" : "todoSaved"));
			}
			close();
		} catch {
			toast(t("saveFailed"));
			setSaving(false);
		}
	};

	if (!isOpen) return null;

	const config = typeConfig[captureType];
	const Icon = config.icon;

	return (
		<div
			className="fixed inset-0 z-150 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) close();
			}}
		>
			<div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl">
				<div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
					<Icon className="h-4 w-4 text-primary" aria-hidden />
					<span className="text-sm font-medium">{t(config.titleKey)}</span>
					<button
						type="button"
						onClick={close}
						className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
						aria-label="close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
				<textarea
					ref={inputRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							void handleSubmit();
						}
						if (e.key === "Escape") {
							e.preventDefault();
							close();
						}
					}}
					placeholder={t(config.placeholderKey)}
					rows={5}
					className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed focus:outline-none"
				/>
				<div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
					<span className="text-xs text-muted-foreground">{t("enterHint")}</span>
					<button
						type="button"
						onClick={() => void handleSubmit()}
						disabled={!text.trim() || saving}
						className={cn(
							"rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground transition-all active:scale-[0.98]",
							"hover:opacity-90 disabled:opacity-40",
						)}
					>
						{t("save")}
					</button>
				</div>
			</div>
		</div>
	);
}
