"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { CollectionNoteView } from "@/lib/query";
import { cn } from "@/lib/utils";

interface CollectionPlayViewProps {
	notes: CollectionNoteView[];
	onOpenNote?: (id: number) => void;
}

const SWIPE_THRESHOLD = 80;

/**
 * 卡片滑动视图（沉浸式逐条翻阅）—— 可扩展「播放模板」的首个模式。
 * 一条笔记一张卡，左右拖拽（或点箭头）切换上一条/下一条。
 * 后续书页/列表模式可实现同一接口插入右侧视图切换器。
 */
export function CollectionPlayView({ notes, onOpenNote }: CollectionPlayViewProps) {
	const t = useTranslations("collection");
	const [index, setIndex] = useState(0);
	const [direction, setDirection] = useState(0);

	if (notes.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
				<p>{t("noNotes")}</p>
			</div>
		);
	}

	const safeIndex = Math.min(index, notes.length - 1);
	const current = notes[safeIndex];

	const go = (delta: number) => {
		const next = safeIndex + delta;
		if (next < 0 || next >= notes.length) return;
		setDirection(delta);
		setIndex(next);
	};

	const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
		if (info.offset.x < -SWIPE_THRESHOLD) go(1);
		else if (info.offset.x > SWIPE_THRESHOLD) go(-1);
	};

	return (
		<div className="flex h-full flex-col">
			{/* 卡片舞台 */}
			<div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
				<AnimatePresence initial={false} custom={direction} mode="popLayout">
					<motion.div
						key={current.id}
						custom={direction}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.6}
						onDragEnd={handleDragEnd}
						initial={{ opacity: 0, x: direction >= 0 ? 120 : -120, scale: 0.96 }}
						animate={{ opacity: 1, x: 0, scale: 1 }}
						exit={{ opacity: 0, x: direction >= 0 ? -120 : 120, scale: 0.96 }}
						transition={{ type: "spring", stiffness: 300, damping: 30 }}
						className="max-h-full w-full max-w-[640px] cursor-grab select-none overflow-y-auto rounded-(--radius) bg-[oklch(var(--card))] p-6 shadow-[0_2px_12px_0_rgba(0,0,0,0.08)] active:cursor-grabbing"
					>
						<div className="mb-2 flex items-center justify-between gap-3">
							<h3 className="text-base font-semibold text-foreground">
								{current.name || t("untitledNote")}
							</h3>
							{onOpenNote && (
								<button
									type="button"
									onClick={() => onOpenNote(current.id)}
									className="shrink-0 text-xs text-primary hover:underline"
								>
									{t("openNote")}
								</button>
							)}
						</div>
						{current.date && (
							<p className="mb-3 text-[11px] text-muted-foreground/70">
								{new Date(current.date).toLocaleString()}
							</p>
						)}
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
							{current.preview || t("emptyNote")}
						</p>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* 控制条 */}
			<div className="flex items-center justify-center gap-4 py-3">
				<button
					type="button"
					onClick={() => go(-1)}
					disabled={safeIndex === 0}
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-muted/40",
						safeIndex === 0 && "cursor-not-allowed opacity-40",
					)}
					aria-label={t("prev")}
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<span className="min-w-[60px] text-center text-xs tabular-nums text-muted-foreground">
					{safeIndex + 1} / {notes.length}
				</span>
				<button
					type="button"
					onClick={() => go(1)}
					disabled={safeIndex === notes.length - 1}
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-muted/40",
						safeIndex === notes.length - 1 && "cursor-not-allowed opacity-40",
					)}
					aria-label={t("next")}
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
