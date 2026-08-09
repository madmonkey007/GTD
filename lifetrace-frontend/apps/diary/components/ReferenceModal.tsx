"use client";

import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Link2, Loader2, Pencil, Trash2, X } from "lucide-react";
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
		<div className="group rounded-lg border border-border/50 bg-card/40 px-3 py-2.5 transition-colors hover:border-border/80 hover:bg-card">
			<div className="flex items-center gap-2">
				{side === "out" ? (
					<ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-primary/60" />
				) : (
					<ArrowDownLeft className="w-3.5 h-3.5 shrink-0 text-primary/60" />
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="inline-flex items-center gap-0.5 rounded-full border border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground active:scale-[0.97]"
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
				<span className="ml-auto text-[11px] text-muted-foreground/60 tabular-nums">
					{formatTime(cp?.date ?? link.createdAt)}
				</span>
				<button
					type="button"
					onClick={() => deleteNoteLink(link.id)}
					title="删除链接"
					className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/30 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 active:scale-90"
				>
					<Trash2 className="w-3 h-3" />
				</button>
			</div>
			{cp && cp.preview && (
				<div className="mt-1.5 text-xs leading-relaxed text-foreground/80 line-clamp-3">
					{cp.name && (
						<span className="mb-0.5 block truncate text-[11px] font-medium text-muted-foreground">
							{cp.name}
						</span>
					)}
					{renderContentWithTags(cp.preview)}
				</div>
			)}
			{editing ? (
				<div className="mt-1.5 flex items-start gap-1">
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
						className="h-7 flex-1 rounded-md border border-border/50 bg-background/60 px-2 text-xs text-foreground focus:border-primary/40 focus:outline-none"
					/>
					<button
						type="button"
						onClick={commitNote}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-primary active:scale-90"
					>
						<Check className="w-3.5 h-3.5" />
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setEditing(true)}
					className="mt-1.5 block w-full text-left"
				>
					{link.userNote ? (
						<div className="text-xs leading-relaxed text-foreground/70 transition-colors group-hover:text-foreground">
							{link.userNote}
						</div>
					) : (
						<div className="flex items-center gap-1 text-[11px] text-muted-foreground/40 italic transition-colors group-hover:text-muted-foreground/70">
							<Pencil className="h-2.5 w-2.5" />
							添加说明
						</div>
					)}
				</button>
			)}
		</div>
	);
}

/** 链接分组标题：方向图标 + 名称 + 计数 */
function LinkGroupHeader({
	icon,
	label,
	count,
}: {
	icon: React.ReactNode;
	label: string;
	count: number;
}) {
	return (
		<div className="mb-2 flex items-center gap-1.5">
			<span className="text-primary/70">{icon}</span>
			<span className="text-xs font-semibold text-foreground/90">{label}</span>
			<span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
				{count}
			</span>
		</div>
	);
}

export function ReferenceModal({ isOpen, onClose, note, noteName, allNotes }: ReferenceModalProps) {
	// 链接（NoteLink）
	const { data: noteLinks, isLoading } = useNoteLinks(note.id);
	const tOut = noteLinks?.outgoing ?? [];
	const tIn = noteLinks?.incoming ?? [];
	const [showAddLink, setShowAddLink] = useState(false);

	const contentLines = (note.userNotes ?? "").split("\n");
	const totalLinks = tOut.length + tIn.length;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="w-[95vw] max-w-[1120px] h-[80vh] max-h-[600px] gap-0 p-0 overflow-hidden flex flex-col">
				<DialogTitle className="sr-only">笔记引用关系</DialogTitle>

				{/* 顶栏：当前笔记名 + 链接总数 + 关闭 */}
				<div className="flex shrink-0 items-center justify-between border-b border-border/40 px-5 py-3.5">
					<div className="min-w-0 flex items-baseline gap-2.5">
						<h3 className="text-sm font-semibold text-foreground">引用关系</h3>
						<span className="min-w-0 truncate text-xs text-muted-foreground">
							{noteName}
						</span>
					</div>
					<div className="flex items-center gap-2.5">
						<span className="text-[11px] text-muted-foreground/70 tabular-nums">
							{totalLinks} 条链接
						</span>
						<button
							type="button"
							onClick={onClose}
							aria-label="关闭"
							className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground active:scale-90"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>

				<div className="flex min-h-0 flex-1 flex-col md:flex-row">
					{/* 左侧：原始笔记 */}
					<div className="flex shrink-0 flex-col overflow-hidden border-b border-border/30 bg-muted/20 md:w-[42%] md:border-b-0 md:border-r">
						<div className="px-5 pt-4 pb-2">
							<span className="text-xs font-medium text-foreground/80">原始笔记</span>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
							<div className="text-xs font-semibold leading-relaxed text-foreground/90">
								{noteName}
							</div>
							<div className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
								{renderContentWithTags(contentLines.join("\n"))}
							</div>
							<div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground/50">
								{formatTime(note.createdAt)}
							</div>
						</div>
					</div>

					{/* 右侧：链接 */}
					<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<div className="flex shrink-0 items-center justify-between border-b border-border/30 px-5 py-3">
							<span className="text-sm font-semibold text-foreground">链接</span>
							<button
								type="button"
								onClick={() => setShowAddLink(true)}
								className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20 active:scale-[0.97]"
							>
								<Link2 className="h-3.5 w-3.5" />
								添加链接
							</button>
						</div>
						<div className="flex-1 overflow-y-auto px-5 py-4">
							{isLoading && (
								<div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground/60">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									加载中
								</div>
							)}
							{!isLoading && tOut.length === 0 && tIn.length === 0 && (
								<div className="flex flex-col items-center gap-4 py-12 text-center">
									<div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
										<Link2 className="h-4.5 w-4.5 text-muted-foreground/50" />
									</div>
									<div className="space-y-1">
										<div className="text-sm font-medium text-foreground/80">还没有链接</div>
										<div className="text-xs text-muted-foreground/60">
											关联相似的笔记，把它们织成一张网
										</div>
									</div>
									<button
										type="button"
										onClick={() => setShowAddLink(true)}
										className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20 active:scale-[0.97]"
									>
										<Link2 className="h-3.5 w-3.5" />
										关联相似笔记
									</button>
								</div>
							)}
							{!isLoading && totalLinks > 0 && (
								<div className="space-y-5">
									{tOut.length > 0 && (
										<div>
											<LinkGroupHeader
												icon={<ArrowUpRight className="h-3.5 w-3.5" />}
												label="引用"
												count={tOut.length}
											/>
											<div className="space-y-1.5">
												{tOut.map((link) => (
													<LinkItem key={link.id} link={link} side="out" />
												))}
											</div>
										</div>
									)}
									{tIn.length > 0 && (
										<div>
											<LinkGroupHeader
												icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
												label="被引用"
												count={tIn.length}
											/>
											<div className="space-y-1.5">
												{tIn.map((link) => (
													<LinkItem key={link.id} link={link} side="in" />
												))}
											</div>
										</div>
									)}
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
