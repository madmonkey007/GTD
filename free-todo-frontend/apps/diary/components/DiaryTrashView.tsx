"use client";

import { AlertCircle, ChevronDown, ChevronUp, Clock, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import type { TrashEntry } from "@/apps/diary/hooks/useJournalTrash";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DiaryTrashViewProps {
	trashEntries: TrashEntry[];
	onRestore: (entry: TrashEntry) => void;
	onClearTrash: () => void;
}

function formatTime(dateStr: string) {
	const d = new Date(dateStr);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderContentWithTags(text: string): React.ReactNode[] {
	const parts = text.split(/(\s?#\S+)/g);
	return parts.map((part, i) => {
		const m = part.match(/^\s?#(\S+)$/);
		if (m && m[1]) {
			const leading = part.startsWith(" ") ? " " : "";
			return (
				<Fragment key={i}>
					{leading}
					<span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary align-middle">
						#{m[1]}
					</span>
				</Fragment>
			);
		}
		return <Fragment key={i}>{part}</Fragment>;
	});
}

export function DiaryTrashView({
	trashEntries,
	onRestore,
	onClearTrash,
}: DiaryTrashViewProps) {
	const t = useTranslations("journalPanel");
	const [clearDialogOpen, setClearDialogOpen] = useState(false);
	const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

	const toggleCard = (id: number) => {
		setExpandedCards((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 shrink-0">
				<div className="flex items-center gap-2">
					<Trash2 className="w-4 h-4 text-muted-foreground/40" />
					<h2 className="text-sm font-semibold tracking-tight">{t("sidebarTrash")}</h2>
					{trashEntries.length > 0 && (
						<span className="text-[11px] text-muted-foreground/40 font-normal">
							({trashEntries.length})
						</span>
					)}
				</div>
				{trashEntries.length > 0 && (
					<button
						type="button"
						onClick={() => setClearDialogOpen(true)}
						className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-destructive/70 hover:bg-destructive/5 hover:text-destructive transition-colors"
					>
						<AlertCircle className="w-3.5 h-3.5" />
						{t("trashClearAll")}
					</button>
				)}
			</div>

			{/* Cards list */}
			<div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
				{trashEntries.length === 0 ? (
					<div className="flex h-full items-center justify-center">
						<p className="text-xs text-muted-foreground/40 italic">
							{t("trashEmpty")}
						</p>
					</div>
				) : (
					trashEntries.map((entry) => {
						const isExpanded = expandedCards.has(entry.id);
						const contentLines = entry.userNotes?.split("\n") ?? [];
						const isLong = contentLines.length > 20;
						const displayContent = isExpanded ? contentLines : contentLines.slice(0, 20);

						return (
							<motion.div
								key={entry.id}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
								className="rounded-xl border border-border/30 bg-card px-4 py-3 transition-all duration-200 hover:border-border/60"
							>
								{entry.name && (
									<div className="text-sm font-semibold text-foreground mb-1 truncate">
										{entry.name}
									</div>
								)}
								{entry.userNotes && (
									<div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
										{renderContentWithTags(displayContent.join("\n"))}
										{!isExpanded && isLong && (
											<span className="text-muted-foreground/40">{"\n"}...</span>
										)}
									</div>
								)}
								{isLong && (
									<button
										type="button"
										onClick={() => toggleCard(entry.id)}
										className="flex items-center gap-1 text-xs text-primary/60 hover:text-primary mt-1 transition-colors"
									>
										{isExpanded ? (
											<><ChevronUp className="w-3 h-3" />{" "}</>
										) : (
											<><ChevronDown className="w-3 h-3" />{" "}({contentLines.length})</>
										)}
									</button>
								)}
								<div className="flex items-center justify-between mt-2">
									<div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
										<Clock className="w-3 h-3" />
										{formatTime(entry.deletedAt)}
									</div>
									<button
										type="button"
										onClick={() => onRestore(entry)}
										className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary/70 hover:text-primary hover:bg-primary/8 transition-colors"
									>
										<RotateCcw className="w-3.5 h-3.5" />
										{t("trashRestore")}
									</button>
								</div>
							</motion.div>
						);
					})
				)}
			</div>

			{/* Clear all confirmation */}
			<AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
				<AlertDialogContent className="p-0 gap-0 overflow-hidden max-w-sm border-l-[3px] border-l-destructive/30 shadow-xl">
					<div className="flex gap-4 p-6 pb-5">
						<div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/8 flex items-center justify-center ring-1 ring-destructive/15">
							<AlertCircle className="w-5 h-5 text-destructive/60" />
						</div>
						<div className="flex-1 min-w-0 pt-0.5">
							<AlertDialogHeader className="space-y-1 p-0">
								<AlertDialogTitle className="text-base font-semibold">{t("trashClearConfirm")}</AlertDialogTitle>
								<AlertDialogDescription className="text-sm text-muted-foreground/70 leading-relaxed">
									{t("deleteConfirmMessage")}
								</AlertDialogDescription>
							</AlertDialogHeader>
						</div>
					</div>
					<div className="h-px bg-border/40" />
					<AlertDialogFooter className="px-6 py-3.5 sm:justify-end gap-2">
						<AlertDialogCancel className="relative rounded-lg h-9 px-4 text-xs font-medium border border-border/60 bg-background hover:bg-muted/40 hover:text-foreground transition-all active:scale-[0.97]">
							{t("cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							className="relative rounded-lg h-9 px-4 text-xs font-medium bg-destructive/90 text-destructive-foreground hover:bg-destructive active:scale-[0.97] transition-all"
							onClick={() => {
								onClearTrash();
								setClearDialogOpen(false);
							}}
						>
							{t("trashClearAll")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
