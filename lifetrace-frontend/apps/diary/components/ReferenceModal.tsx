"use client";

import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Link2, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
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
import { renderContentWithTags } from "./shared";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { cn } from "@/lib/utils";

interface ReferenceModalProps {
	isOpen: boolean;
	onClose: () => void;
	note: JournalView;
	/** 当前笔记的名称/标题 */
	noteName: string;
	/** 所有笔记，用于查询引用和被引用关系 */
	allNotes: JournalView[];
}

/** 关系类型 → 中文标签 */
const RELATION_LABEL: Record<RelationType, string> = {
	SUPPORTS: "支撑",
	EXTENDS: "延伸",
	CONTRADICTS: "矛盾",
	RELATES: "相关",
};

/** 从 markdown 正文提取图片 URL 列表 */
function extractImages(text: string): string[] {
	const urls: string[] = [];
	const re = /!\[[^\]]*\]\(([^)]+)\)/g;
	let m;
	while ((m = re.exec(text)) && urls.length < 9) {
		urls.push(m[1]);
	}
	return urls;
}

/** 去除 markdown 图片语法：图片由 NoteImageStrip 单独渲染，避免正文里出现原始 ![]() 文本 */
function stripImages(text: string): string {
	return text
		.replace(/!\[[^\]]*\]\([^)]+\)/g, "")
		.replace(/\n[ \t]*\n[ \t]*\n/g, "\n\n")
		.trim();
}

/** 同一目标的多条链接按 counterpart 去重合并成一张卡 */
function groupByCounterpart(links: NoteLinkView[]): NoteLinkView[][] {
	const map = new Map<number | string, NoteLinkView[]>();
	for (const l of links) {
		const key = l.counterpart?.id ?? `link-${l.id}`;
		if (!map.has(key)) map.set(key, []);
		map.get(key)!.push(l);
	}
	return [...map.values()];
}

/** 关系类型标签：可下拉切换该条链接的类型 */
function RelationChip({
	link,
	onChange,
}: {
	link: NoteLinkView;
	onChange: (linkId: number, type: RelationType) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary transition-all hover:bg-primary/15 active:scale-[0.97]"
				>
					{RELATION_LABEL[link.relationType]}
					<ChevronDown className="w-2.5 h-2.5 opacity-60" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-[88px]">
				{RELATION_TYPES.map((rt) => (
					<DropdownMenuItem
						key={rt}
						onClick={() => onChange(link.id, rt)}
						className="text-xs"
					>
						{RELATION_LABEL[rt]}
						{link.relationType === rt && <Check className="w-3 h-3 ml-auto" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** 图片缩略图行（从完整 userNotes 解析） */
function NoteImageStrip({ images }: { images: string[] }) {
	if (images.length === 0) return null;
	return (
		<div className="mt-2 flex gap-1.5">
			{images.slice(0, 3).map((src, i) => (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					key={`${src}-${i}`}
					src={src}
					alt=""
					className="h-10 w-10 shrink-0 rounded-md border border-border/40 object-cover"
				/>
			))}
			{images.length > 3 && (
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] text-muted-foreground tabular-nums">
					+{images.length - 3}
				</span>
			)}
		</div>
	);
}

/** 一张合并后的链接卡：对端标题 + 内容 + 图片 + 关系标签组 + 说明（按钮触发）+ 删除 */
function LinkCard({
	links,
	allNotes,
	onChangeType,
	onDeleteAll,
}: {
	links: NoteLinkView[];
	allNotes: JournalView[];
	onChangeType: (linkId: number, type: RelationType) => void;
	onDeleteAll: (links: NoteLinkView[]) => void;
}) {
	const { updateNoteLink } = useNoteLinkMutations();
	const [editing, setEditing] = useState(false);
	const isMobile = useIsMobile();
	const [draft, setDraft] = useState(
		links.find((l) => l.userNote)?.userNote ?? links[0].userNote ?? "",
	);
	const cp = links[0].counterpart;
	const cpId = cp?.id;
	// 用完整笔记内容渲染图片与更完整预览
	const fullNote = cpId != null ? allNotes.find((n) => n.id === cpId) : undefined;
	const fullContent = fullNote?.userNotes ?? cp?.preview ?? "";
	const images = useMemo(() => extractImages(fullContent), [fullContent]);
	const noteText = useMemo(() => stripImages(fullContent), [fullContent]);
	const hasNote = links.some((l) => l.userNote);

	const commitNote = () => {
		setEditing(false);
		const target = links.find((l) => l.userNote) ?? links[0];
		if (target && draft !== (target.userNote ?? "")) {
			updateNoteLink({ linkId: target.id, input: { userNote: draft } });
		}
	};

	return (
		<div className="group rounded-lg border border-border/50 bg-card/40 px-3 py-2.5 transition-colors hover:border-border/80 hover:bg-card">
			{/* 标题：对端笔记名（仅一次；方向由所在分组标题承载，不再重复箭头） */}
			<div className="truncate text-sm font-medium text-foreground/90">
				{cp?.name || "无标题"}
			</div>

			{/* 内容预览（已剔除图片语法，图片由下方缩略图承载） */}
			{noteText && (
				<div className="mt-1 text-sm leading-relaxed text-foreground/70">
					{renderContentWithTags(noteText)}
				</div>
			)}
			<NoteImageStrip images={images} />

			{/* meta 行：关系标签组 + 说明按钮 + 删除 */}
			<div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-1.5">
				{links.map((l) => (
					<RelationChip key={l.id} link={l} onChange={onChangeType} />
				))}
				<button
					type="button"
					onClick={() => setEditing((v) => !v)}
					title={hasNote ? "编辑说明" : "添加说明"}
					className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground active:scale-[0.97]"
				>
					{hasNote ? <Check className="h-3 w-3 text-primary/60" /> : <Pencil className="h-3 w-3" />}
					说明
				</button>
				<button
					type="button"
					onClick={() => onDeleteAll(links)}
					title="删除链接"
					className={cn("flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/30 transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90", isMobile ? "h-8 w-8 opacity-100" : "opacity-0 group-hover:opacity-100")}
				>
					<Trash2 className="w-3 h-3" />
				</button>
			</div>

			{/* 说明输入：点击「说明」按钮后才展开，而非默认显示输入框 */}
			{editing && (
				<div className="mt-2 flex items-start gap-1">
					<input
						autoFocus
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commitNote}
						onKeyDown={(e) => {
							if (e.key === "Enter") commitNote();
							if (e.key === "Escape") {
								setDraft(links.find((l) => l.userNote)?.userNote ?? links[0].userNote ?? "");
								setEditing(false);
							}
						}}
						placeholder="说明这条链接..."
						className="h-7 flex-1 rounded-md border border-border/50 bg-background/60 px-2 text-xs text-foreground focus:border-primary/40 focus:outline-none"
					/>
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={commitNote}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-primary active:scale-90"
					>
						<Check className="w-3.5 h-3.5" />
					</button>
				</div>
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
	const isMobile = useIsMobile();
	const { data: noteLinks, isLoading } = useNoteLinks(note.id);
	const { updateNoteLink, deleteNoteLink } = useNoteLinkMutations();
	const tOut = noteLinks?.outgoing ?? [];
	const tIn = noteLinks?.incoming ?? [];
	const [showAddLink, setShowAddLink] = useState(false);

	const outGroups = useMemo(() => groupByCounterpart(tOut), [tOut]);
	const inGroups = useMemo(() => groupByCounterpart(tIn), [tIn]);
	const totalLinks = outGroups.length + inGroups.length;

	// 当前笔记自身的图片 + 标签
	const currentImages = useMemo(() => extractImages(note.userNotes ?? ""), [note.userNotes]);
	const currentTags = note.tags ?? [];

	const handleChangeType = (linkId: number, type: RelationType) => {
		updateNoteLink({ linkId, input: { relationType: type } });
	};
	const handleDeleteAll = (links: NoteLinkView[]) => {
		links.forEach((l) => deleteNoteLink(l));
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className={cn(
				"w-[95vw] max-w-[1120px] h-[80vh] max-h-[600px] gap-0 p-0 overflow-hidden flex flex-col",
				// 移动端：全屏弹窗，不受 80vh/600px 限制
				isMobile && "inset-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0",
			)}>
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
					{/* 左侧：当前笔记（强调视觉，与右侧普通链接卡区分） */}
					<div className="flex shrink-0 flex-col overflow-hidden border-b border-border/30 bg-muted/20 md:w-[42%] md:border-b-0 md:border-r">
						<div className="px-5 pt-4 pb-3">
							<div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
								<Link2 className="h-3 w-3" />
								当前笔记
							</div>
							<h4 className="mt-1.5 text-base font-semibold leading-snug text-foreground">
								{noteName}
							</h4>
							<div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/60">
								<span>{note.origin !== "manual" ? `· ${note.origin}` : ""}</span>
							</div>
							{currentTags.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1">
									{currentTags.map((t) => (
										<span
											key={t.tagName}
											className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
										>
											#{t.tagName}
										</span>
									))}
								</div>
							)}
							<NoteImageStrip images={currentImages} />
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto border-t border-border/30 px-5 pb-5 pt-3">
							<div className="text-xs leading-relaxed text-muted-foreground">
								{renderContentWithTags(stripImages(note.userNotes ?? ""))}
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
							{!isLoading && totalLinks === 0 && (
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
									{outGroups.length > 0 && (
										<div>
											<LinkGroupHeader
												icon={<ArrowUpRight className="h-3.5 w-3.5" />}
												label="引用"
												count={outGroups.length}
											/>
											<div className="space-y-1.5">
												{outGroups.map((group) => (
													<LinkCard
														key={group[0].counterpart?.id ?? group[0].id}
														links={group}
														allNotes={allNotes}
														onChangeType={handleChangeType}
														onDeleteAll={handleDeleteAll}
													/>
												))}
											</div>
										</div>
									)}
									{inGroups.length > 0 && (
										<div>
											<LinkGroupHeader
												icon={<ArrowDownLeft className="h-3.5 w-3.5" />}
												label="被引用"
												count={inGroups.length}
											/>
											<div className="space-y-1.5">
												{inGroups.map((group) => (
													<LinkCard
														key={group[0].counterpart?.id ?? group[0].id}
														links={group}
																												allNotes={allNotes}
														onChangeType={handleChangeType}
														onDeleteAll={handleDeleteAll}
													/>
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
