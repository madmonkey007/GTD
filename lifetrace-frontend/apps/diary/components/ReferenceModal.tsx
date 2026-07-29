"use client";

import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Link2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { JournalView } from "@/lib/query";
import {
	RELATION_TYPES,
	useNoteLinkMutations,
	useNoteLinks,
	type NoteLinkView,
	type RelationType,
} from "@/lib/query/note-links";
import { AddNoteLinkModal } from "./AddNoteLinkModal";
import { formatTime, renderContentWithTags } from "./shared";

interface ReferenceModalProps {
	isOpen: boolean;
	onClose: () => void;
	note: JournalView;
	/** 当前笔记的名称/标题 */
	noteName: string;
	/** 所有笔记，用于查询引用和被引用关系 */
	allNotes: JournalView[];
}

/** 关系类型 → 中文标签（统一样式，不区分颜色，弱化标签、突出内容） */
const RELATION_LABEL: Record<RelationType, string> = {
	SUPPORTS: "支撑",
	EXTENDS: "延伸",
	CONTRADICTS: "矛盾",
	RELATES: "相关",
};

/** 单条链接：类型下拉切换、说明可编、可删 */
function LinkItem({ link, side }: { link: NoteLinkView; side: "out" | "in" }) {
	const { updateNoteLink, deleteNoteLink } = useNoteLinkMutations();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(link.userNote ?? "");
	const cp = link.counterpart;

	const commitNote = () => {
		setEditing(false);
		if (draft !== (link.userNote ?? "")) {
			updateNoteLink({ linkId: link.id, input: { userNote: draft } });
		}
	};

	return (
		<div className="rounded-lg border border-border/30 bg-card px-3 py-2">
			<div className="flex items-center gap-1.5 mb-1">
				{side === "out" ? (
					<ArrowUpRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
				) : (
					<ArrowDownLeft className="w-3 h-3 text-muted-foreground/50 shrink-0" />
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
						>
							{RELATION_LABEL[link.relationType]}
							<ChevronDown className="w-2.5 h-2.5 opacity-60" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="min-w-[88px]">
						{RELATION_TYPES.map((rt) => (
							<DropdownMenuItem
								key={rt}
								onClick={() =>
									updateNoteLink({
										linkId: link.id,
										input: { relationType: rt },
									})
								}
								className="text-xs"
							>
								{RELATION_LABEL[rt]}
								{link.relationType === rt && (
									<Check className="w-3 h-3 ml-auto" />
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<button
					type="button"
					onClick={() => deleteNoteLink(link.id)}
					title="删除链接"
					className="ml-auto text-muted-foreground/30 hover:text-destructive transition-colors"
				>
					<Trash2 className="w-3 h-3" />
				</button>
			</div>
			{cp && (
				<div className="text-[10px] text-muted-foreground/40 truncate mb-0.5">
					{cp.name || "无标题"}
				</div>
			)}
			{cp && cp.preview && (
				<div className="text-xs text-foreground/80 leading-relaxed line-clamp-3 mb-1">
					{renderContentWithTags(cp.preview)}
				</div>
			)}
			{editing ? (
				<div className="flex items-start gap-1">
					<input
						autoFocus
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commitNote}
						onKeyDown={(e) => {
							if (e.key === "Enter") commitNote();
							if (e.key === "Escape") {
								setDraft(link.userNote ?? "");
								setEditing(false);
							}
						}}
						placeholder="说明这条链接..."
						className="flex-1 h-7 rounded border border-border/40 bg-background/60 px-2 text-[11px] text-foreground focus:outline-none focus:border-primary/40"
					/>
					<button
						type="button"
						onClick={commitNote}
						className="text-muted-foreground/50 hover:text-primary"
					>
						<Check className="w-3 h-3" />
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setEditing(true)}
					className="text-left w-full"
				>
					{link.userNote ? (
						<div className="text-xs text-foreground/70 leading-relaxed hover:text-foreground">
							{link.userNote}
						</div>
					) : (
						<div className="text-[10px] text-muted-foreground/30 italic hover:text-muted-foreground/60 flex items-center gap-1">
							<Pencil className="w-2.5 h-2.5" />
							添加说明...
						</div>
					)}
				</button>
			)}
			{cp && (
				<div className="text-[10px] text-muted-foreground/40 mt-1">
					{formatTime(cp.date ?? link.createdAt)}
				</div>
			)}
		</div>
	);
}

export function ReferenceModal({ isOpen, onClose, note, noteName, allNotes }: ReferenceModalProps) {
	// 链接（NoteLink）
	const { data: noteLinks } = useNoteLinks(note.id);
	const tOut = noteLinks?.outgoing ?? [];
	const tIn = noteLinks?.incoming ?? [];
	const [showAddLink, setShowAddLink] = useState(false);

	const contentLines = (note.userNotes ?? '').split('\n');

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="w-[95vw] max-w-[1200px] h-[80vh] max-h-[580px] gap-0 p-0 overflow-hidden flex flex-col">
				<DialogTitle className="sr-only">笔记引用关系</DialogTitle>

				<div className="flex min-h-0 flex-1">
					{/* 左侧：原始笔记 */}
					<div className="w-1/2 flex flex-col border-r border-border/30 overflow-hidden">
						<div className="px-4 pt-3 pb-2 border-b border-border/20 bg-muted/10">
							<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">原始笔记</span>
						</div>
						<div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
							{noteName && (
								<div className="text-xs font-semibold text-foreground/90">
									{noteName}
								</div>
							)}
							<div className="text-xs text-muted-foreground leading-relaxed">
								{renderContentWithTags(contentLines.join('\n'))}
							</div>
							<div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground/40">
								{formatTime(note.createdAt)}
							</div>
						</div>
					</div>

					{/* 右侧：链接 */}
					<div className="w-1/2 flex flex-col overflow-hidden">
						<div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/20 bg-muted/10">
							<span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">链接</span>
							<button
								type="button"
								onClick={() => setShowAddLink(true)}
								title="关联相似笔记"
								className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/80 hover:bg-primary/20 transition-colors"
							>
								<Link2 className="w-3 h-3" />
								添加链接
							</button>
						</div>
						<div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
							{tOut.length === 0 && tIn.length === 0 && (
								<div className="flex flex-col items-center gap-3 py-10 text-center">
									<div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
										<Link2 className="w-4 h-4 text-muted-foreground/50" />
									</div>
									<div className="text-xs text-muted-foreground/60">
										暂无链接，关联相似笔记以织起知识网络
									</div>
									<button
										type="button"
										onClick={() => setShowAddLink(true)}
										className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
									>
										<Link2 className="w-3.5 h-3.5" />
										关联相似笔记
									</button>
								</div>
							)}

							{/* 引用（出链） */}
							{tOut.length > 0 && (
								<div>
									<div className="flex items-center gap-1.5 mb-2">
										<ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/50" />
										<span className="text-xs font-medium text-foreground/80">
											引用 ({tOut.length})
										</span>
									</div>
									<div className="space-y-1.5">
										{tOut.map((link) => (
											<LinkItem key={link.id} link={link} side="out" />
										))}
									</div>
								</div>
							)}

							{/* 被引用（入链） */}
							{tIn.length > 0 && (
								<div>
									<div className="flex items-center gap-1.5 mb-2">
										<ArrowDownLeft className="w-3.5 h-3.5 text-muted-foreground/50" />
										<span className="text-xs font-medium text-foreground/80">
											被引用 ({tIn.length})
										</span>
									</div>
									<div className="space-y-1.5">
										{tIn.map((link) => (
											<LinkItem key={link.id} link={link} side="in" />
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
			{showAddLink && (
				<AddNoteLinkModal
					isOpen={true}
					onClose={() => setShowAddLink(false)}
					noteId={note.id}
					noteName={noteName}
				/>
			)}
		</Dialog>
	);
}
