"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { CollectionNoteView } from "@/lib/query";
import { cn } from "@/lib/utils";

interface CollectionPlayViewProps {
	notes: CollectionNoteView[];
	/** 列表点进来时定位到的初始索引 */
	initialIndex?: number;
	onOpenNote?: (id: number) => void;
}

/**
 * 卡片滑动视图（iPod 歌单封面式）：竖向长条卡片居中，点击左右两侧切换
 * 上一条/下一条。是集合详情的展示视图之一（默认仍是卡片列表）。
 */
export function CollectionPlayView({
	notes,
	initialIndex = 0,
	onOpenNote,
}: CollectionPlayViewProps) {
	const t = useTranslations("collection");
	const reduce = useReducedMotion();
	const [index, setIndex] = useState(initialIndex);
	const [direction, setDirection] = useState(0);

	// 外部传入的 initialIndex 变化时（例如从列表点进来）同步定位
	useEffect(() => {
		setIndex(initialIndex);
	}, [initialIndex]);

	const safeIndex = notes.length === 0 ? 0 : Math.min(index, notes.length - 1);

	const go = (delta: number) => {
		const next = safeIndex + delta;
		if (next < 0 || next >= notes.length) return;
		setDirection(delta);
		setIndex(next);
	};

	// 键盘左右切换
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") go(-1);
			else if (e.key === "ArrowRight") go(1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (notes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("noNotes")}
			</div>
		);
	}

	const current = notes[safeIndex];

	return (
		<div className="flex h-full flex-col">
			{/* 舞台：左右两侧点击区 + 中间竖向卡片 */}
			<div className="relative flex flex-1 items-stretch overflow-hidden">
				{/* 左侧点击区 */}
				<button
					type="button"
					onClick={() => go(-1)}
					disabled={safeIndex === 0}
					className={cn(
						"group flex w-16 shrink-0 items-center justify-center transition-transform active:scale-95 sm:w-24",
						safeIndex === 0
							? "cursor-not-allowed opacity-30"
							: "hover:bg-muted/30",
					)}
					aria-label={t("prev")}
				>
					<ChevronLeft className="h-7 w-7 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
				</button>

				{/* 中间竖向卡片 */}
				<div className="relative flex flex-1 items-center justify-center px-2">
					<AnimatePresence initial={false} custom={direction} mode="popLayout">
						<motion.div
							key={current.id}
							custom={direction}
							initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction >= 0 ? 80 : -80, scale: 0.9 }}
							animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
							exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction >= 0 ? -80 : 80, scale: 0.9 }}
							transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 30 }}
							className="flex h-full max-h-[560px] w-full max-w-[360px] flex-col overflow-hidden rounded-(--radius) bg-[oklch(var(--card))] shadow-[0_8px_30px_0_rgba(0,0,0,0.12)]"
						>
							{/* 卡片内容 */}
							<div className="flex-1 overflow-y-auto p-5">
								<div className="mb-2 flex items-center justify-between gap-2">
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
							</div>
						</motion.div>
					</AnimatePresence>
				</div>

				{/* 右侧点击区 */}
				<button
					type="button"
					onClick={() => go(1)}
					disabled={safeIndex === notes.length - 1}
					className={cn(
						"group flex w-16 shrink-0 items-center justify-center transition-transform active:scale-95 sm:w-24",
						safeIndex === notes.length - 1
							? "cursor-not-allowed opacity-30"
							: "hover:bg-muted/30",
					)}
					aria-label={t("next")}
				>
					<ChevronRight className="h-7 w-7 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
				</button>
			</div>

			{/* 指示器 */}
			<div className="flex items-center justify-center gap-1.5 py-3">
				{notes.map((n, i) => (
					<button
						key={n.id}
						type="button"
						onClick={() => {
							setDirection(i > safeIndex ? 1 : -1);
							setIndex(i);
						}}
						className={cn(
							"h-1.5 rounded-full transition-all",
							i === safeIndex ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30",
						)}
						aria-label={`${i + 1}`}
					/>
				))}
			</div>
		</div>
	);
}
