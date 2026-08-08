"use client";

import { ArrowLeft, ImagePlus, Library, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { uploadJournalImage } from "@/lib/api";
import { compressImageIfNeeded } from "@/lib/imageCompress";
import { useCollection, useCollectionMutations } from "@/lib/query";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CollectionNoteManager } from "./CollectionNoteManager";
import { CollectionPlayView } from "./CollectionPlayView";

interface CollectionDetailProps {
	collectionId: number;
	onBack: () => void;
	onOpenNote?: (id: number) => void;
}

export function CollectionDetail({
	collectionId,
	onBack,
	onOpenNote,
}: CollectionDetailProps) {
	const t = useTranslations("collection");
	const { data: collection, isLoading } = useCollection(collectionId);
	const {
		updateCollectionAsync,
		deleteCollection,
		summarizeAsync,
		summarizePending,
		recommendAsync,
		recommendPending,
		addNotesAsync,
	} = useCollectionMutations();

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [editingDesc, setEditingDesc] = useState(false);
	const [descDraft, setDescDraft] = useState("");
	const [showManager, setShowManager] = useState(false);
	const [summary, setSummary] = useState<string | null>(null);
	const [recommendItems, setRecommendItems] = useState<
		{ journalId: number; name: string | null; reason: string }[] | null
	>(null);

	if (isLoading || !collection) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("loading")}
			</div>
		);
	}

	const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		try {
			const compressed = await compressImageIfNeeded(file);
			const res = await uploadJournalImage(compressed);
			await updateCollectionAsync({ id: collectionId, input: { coverImageUrl: res.url } });
		} catch (err) {
			toastError(err instanceof Error ? err.message : t("coverUploadFailed"));
		}
	};

	const handleSaveDesc = async () => {
		await updateCollectionAsync({ id: collectionId, input: { description: descDraft } });
		setEditingDesc(false);
	};

	const handleSummarize = async () => {
		try {
			const text = await summarizeAsync(collectionId);
			setSummary(text);
		} catch {
			toastError(t("aiFailed"));
		}
	};

	const handleRecommend = async () => {
		try {
			const items = await recommendAsync(collectionId);
			setRecommendItems(items);
		} catch {
			toastError(t("aiFailed"));
		}
	};

	const confirmRecommend = async (ids: number[]) => {
		if (ids.length > 0) await addNotesAsync({ id: collectionId, journalIds: ids });
		setRecommendItems(null);
	};

	const memberIds = (collection.notes ?? []).map((n) => n.id);

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* 顶栏 */}
			<div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-2.5">
				<div className="flex min-w-0 items-center gap-2">
					<button
						type="button"
						onClick={onBack}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"
						aria-label={t("back")}
					>
						<ArrowLeft className="h-4 w-4" />
					</button>
					<span className="truncate text-sm font-semibold">{collection.name}</span>
				</div>
				<div className="flex items-center gap-1">
					{/* 视图切换器（可扩展，当前仅卡片滑动） */}
					<div className="mr-1 flex items-center gap-1 rounded-md border border-border/50 p-0.5">
						<button
							type="button"
							className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-primary"
							title={t("viewSwipe")}
						>
							<Library className="h-3 w-3" />
							{t("viewSwipe")}
						</button>
					</div>
					<button
						type="button"
						onClick={handleSummarize}
						disabled={summarizePending}
						className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
						title={t("summarize")}
					>
						<Sparkles className="h-3.5 w-3.5" />
						{summarizePending ? t("aiLoading") : t("summarize")}
					</button>
					<button
						type="button"
						onClick={handleRecommend}
						disabled={recommendPending}
						className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
						title={t("recommend")}
					>
						<Wand2 className="h-3.5 w-3.5" />
						{recommendPending ? t("aiLoading") : t("recommend")}
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{/* 封面 */}
				<div className="group relative h-40 w-full bg-muted/40">
					{collection.coverImageUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={collection.coverImageUrl}
							alt=""
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
							<Library className="h-8 w-8" />
						</div>
					)}
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100"
					>
						<span className="flex items-center gap-1.5 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground">
							<ImagePlus className="h-3.5 w-3.5" />
							{t("changeCover")}
						</span>
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleCoverPick}
					/>
				</div>

				<div className="px-4 py-3">
					{/* 描述 */}
					{editingDesc ? (
						<div className="mb-3 flex flex-col gap-2">
							<textarea
								value={descDraft}
								onChange={(e) => setDescDraft(e.target.value)}
								rows={3}
								className="w-full rounded-md border border-border/50 bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
								placeholder={t("descriptionPlaceholder")}
							/>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={handleSaveDesc}
									className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
								>
									{t("save")}
								</button>
								<button
									type="button"
									onClick={() => setEditingDesc(false)}
									className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/40"
								>
									{t("cancel")}
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => {
								setDescDraft(collection.description ?? "");
								setEditingDesc(true);
							}}
							className="mb-3 block w-full text-left text-sm text-muted-foreground hover:text-foreground"
						>
							{collection.description || t("descriptionPlaceholder")}
						</button>
					)}

					{/* 管理笔记 / 删除 */}
					<div className="mb-2 flex items-center justify-between">
						<span className="text-xs font-medium text-muted-foreground">
							{t("notesCount", { count: collection.noteCount })}
						</span>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setShowManager(true)}
								className="rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"
							>
								{t("manageNotes")}
							</button>
							<button
								type="button"
								onClick={() => {
									if (confirm(t("deleteConfirm"))) {
										deleteCollection(collectionId);
										onBack();
									}
								}}
								className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 hover:text-destructive"
								aria-label={t("delete")}
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>

					{/* 卡片滑动视图 */}
					<div className="h-[calc(100vh-380px)] min-h-[260px]">
						<CollectionPlayView
							notes={collection.notes ?? []}
							onOpenNote={onOpenNote}
						/>
					</div>
				</div>
			</div>

			{/* 管理笔记弹层 */}
			{showManager && (
				<CollectionNoteManager
					collectionId={collectionId}
					memberIds={memberIds}
					onClose={() => setShowManager(false)}
				/>
			)}

			{/* AI 摘要弹层 */}
			{summary !== null && (
				<SummaryModal
					text={summary}
					onClose={() => setSummary(null)}
					onUseAsDescription={async () => {
						await updateCollectionAsync({ id: collectionId, input: { description: summary } });
						setSummary(null);
					}}
				/>
			)}

			{/* AI 推荐弹层 */}
			{recommendItems !== null && (
				<RecommendModal
					items={recommendItems}
					onClose={() => setRecommendItems(null)}
					onConfirm={confirmRecommend}
				/>
			)}
		</div>
	);
}

function SummaryModal({
	text,
	onClose,
	onUseAsDescription,
}: {
	text: string;
	onClose: () => void;
	onUseAsDescription: () => void;
}) {
	const t = useTranslations("collection");
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div className="flex max-h-[70vh] w-full max-w-md flex-col rounded-(--radius) bg-background shadow-xl">
				<div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
					<h3 className="text-sm font-semibold">{t("summaryTitle")}</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-muted-foreground hover:text-foreground"
					>
						✕
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-foreground/80">
					{text}
				</div>
				<div className="flex justify-end gap-2 border-t border-border/40 px-4 py-3">
					<button
						type="button"
						onClick={onUseAsDescription}
						className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
					>
						{t("useAsDescription")}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
					>
						{t("close")}
					</button>
				</div>
			</div>
		</div>
	);
}

function RecommendModal({
	items,
	onClose,
	onConfirm,
}: {
	items: { journalId: number; name: string | null; reason: string }[];
	onClose: () => void;
	onConfirm: (ids: number[]) => void;
}) {
	const t = useTranslations("collection");
	const [picked, setPicked] = useState<Set<number>>(() => new Set(items.map((i) => i.journalId)));
	const toggle = (id: number) =>
		setPicked((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div className="flex max-h-[75vh] w-full max-w-md flex-col rounded-(--radius) bg-background shadow-xl">
				<div className="border-b border-border/40 px-4 py-3">
					<h3 className="text-sm font-semibold">{t("recommendTitle")}</h3>
					<p className="mt-0.5 text-xs text-muted-foreground">{t("recommendHint")}</p>
				</div>
				<div className="flex-1 overflow-y-auto p-2">
					{items.length === 0 ? (
						<p className="px-3 py-6 text-center text-xs text-muted-foreground">
							{t("noCandidates")}
						</p>
					) : (
						items.map((it) => {
							const on = picked.has(it.journalId);
							return (
								<button
									key={it.journalId}
									type="button"
									onClick={() => toggle(it.journalId)}
									className={cn(
										"mb-1 flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
										on ? "bg-primary/10 text-primary" : "hover:bg-muted/40",
									)}
								>
									<span
										className={cn(
											"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
											on ? "border-primary bg-primary text-primary-foreground" : "border-border/60",
										)}
									>
										{on && <span className="text-[10px]">✓</span>}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">
											{it.name || t("untitledNote")}
										</span>
										{it.reason && (
											<span className="mt-0.5 block text-xs text-muted-foreground">
												{it.reason}
											</span>
										)}
									</span>
								</button>
							);
						})
					)}
				</div>
				<div className="flex justify-end gap-2 border-t border-border/40 px-4 py-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
					>
						{t("cancel")}
					</button>
					<button
						type="button"
						onClick={() => onConfirm([...picked])}
						className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
					>
						{t("addSelected")}
					</button>
				</div>
			</div>
		</div>
	);
}
