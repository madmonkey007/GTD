"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TimeMachineNoteCard } from "./TimeMachineNoteCard";
import { useJournalStore } from "@/lib/store/journal-store";
import type { JournalView } from "@/lib/query";
import type { LinkedNote } from "@/lib/store/note-chat-store";

interface TimeMachineCarouselProps {
	notes: JournalView[];
	notesList: JournalView[];
	relatedNotesData?: JournalView[];
	pinnedIds: number[];
	startEditing: (note: JournalView) => void;
	setDeleteDialogNote: (note: JournalView) => void;
	onTogglePin: (id: number) => void;
	onAnnotate?: (note: JournalView) => void;
	setAddLinkNote: (note: JournalView) => void;
	addLinkedNote: (note: LinkedNote) => void;
	onSimilarClick?: (id: number) => void;
	onOpenReference: (note: JournalView) => void;
	formatTime: (dateStr: string) => string;
	t: (key: string) => string;
}

const SWIPE_THRESHOLD = 80; // px：超过此距离才翻页
const VELOCITY_THRESHOLD = 0.4; // 速度阈值

/**
 * 时光机器·左右滑动轮播。
 *
 * 一次展示一张笔记卡片，每张按 index % 8 分配不同视觉样式（取自引用设计的 8 种）。
 * 交互：左右拖拽 + 左右箭头按钮 + 底部圆点指示器 + 键盘 ←/→。
 * 单条笔记时隐藏控制器。
 *
 * 性能：只渲染当前卡片（AnimatePresence mode="popLayout"），不预渲染全部。
 */
export function TimeMachineCarousel({
	notes,
	notesList,
	relatedNotesData,
	pinnedIds,
	startEditing,
	setDeleteDialogNote,
	onTogglePin,
	onAnnotate,
	setAddLinkNote,
	addLinkedNote,
	onSimilarClick,
	onOpenReference,
	formatTime,
	t,
}: TimeMachineCarouselProps) {
	const [[index, direction], setState] = useState<[number, number]>([0, 0]);
	const containerRef = useRef<HTMLDivElement>(null);
	// 时光机卡片样式设置：随机 = 每张按 index % 8；固定 = 全部使用选中的风格
	const timeMachineStyleMode = useJournalStore((s) => s.timeMachineStyleMode);
	const timeMachineStyle = useJournalStore((s) => s.timeMachineStyle);

	const total = notes.length;

	// 笔记数组变化时，索引钳制（防止越界）
	useEffect(() => {
		setState(([prev]) => {
			if (total === 0) return [0, 0];
			return [Math.min(prev, total - 1), 0];
		});
	}, [total]);

	const paginate = useCallback((dir: number) => {
		setState(([prev]) => {
			const next = Math.max(0, Math.min(prev + dir, total - 1));
			return [next, dir];
		});
	}, [total]);

	const goTo = useCallback((i: number) => {
		setState(([prev]) => [i, i > prev ? 1 : -1]);
	}, []);

	const handleDragEnd = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
		const wentRight = info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD;
		const wentLeft = info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD;
		if (wentLeft) paginate(1);
		else if (wentRight) paginate(-1);
	}, [paginate]);

	// 键盘导航
	useEffect(() => {
		if (total <= 1) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				paginate(-1);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				paginate(1);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [paginate, total]);

	if (total === 0) return null;

	const note = notes[Math.min(index, total - 1)];
	if (!note) return null;

	const variant =
		timeMachineStyleMode === "fixed" ? timeMachineStyle : index % 8;
	const showControls = total > 1;
	const atStart = index === 0;
	const atEnd = index === total - 1;

	return (
		<div ref={containerRef} className="relative mx-auto w-full max-w-[400px] select-none">
			{/* 卡片舞台 */}
			<div className="relative overflow-hidden rounded-[20px]">
				<AnimatePresence mode="popLayout" initial={false} custom={direction}>
					<motion.div
						key={note.id}
						custom={direction}
						variants={{
							enter: (d: number) => ({ opacity: 0, x: d >= 0 ? 60 : -60 }),
							center: { opacity: 1, x: 0 },
							exit: (d: number) => ({ opacity: 0, x: d >= 0 ? -60 : 60 }),
						}}
						initial="enter"
						animate="center"
						exit="exit"
						drag={showControls ? "x" : false}
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.18}
						onDragEnd={handleDragEnd}
						transition={{ type: "spring", stiffness: 280, damping: 30 }}
						className="cursor-grab active:cursor-grabbing"
					>
						<TimeMachineNoteCard
							note={note}
							notesList={notesList}
							relatedNotesData={relatedNotesData}
							pinned={pinnedIds.includes(note.id)}
							variant={variant}
							onStartEdit={() => startEditing(note)}
							onDelete={() => setDeleteDialogNote(note)}
							onTogglePin={() => onTogglePin(note.id)}
							onAnnotate={() => onAnnotate?.(note)}
							onOpenLink={() => setAddLinkNote(note)}
							onAddToChat={() => addLinkedNote({
								id: note.id,
								name: note.name ?? "",
								userNotes: note.userNotes ?? "",
								date: note.date,
								tags: note.tags.map((tg) => tg.tagName),
							})}
							onSimilar={() => onSimilarClick?.(note.id)}
							onOpenReference={onOpenReference}
							formatTime={formatTime}
							t={t}
						/>
					</motion.div>
				</AnimatePresence>
			</div>

			{showControls && (
				<>
					{/* 左右箭头按钮 */}
					<button
						type="button"
						onClick={() => paginate(-1)}
						disabled={atStart}
						aria-label="上一条"
						className="absolute left-[-12px] top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card/95 text-foreground shadow-[0_4px_14px_-4px_rgba(0,0,0,0.12)] backdrop-blur transition-all hover:bg-card hover:scale-105 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() => paginate(1)}
						disabled={atEnd}
						aria-label="下一条"
						className="absolute right-[-12px] top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card/95 text-foreground shadow-[0_4px_14px_-4px_rgba(0,0,0,0.12)] backdrop-blur transition-all hover:bg-card hover:scale-105 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30"
					>
						<ChevronRight className="h-4 w-4" />
					</button>

					{/* 底部圆点指示器 + 计数 */}
					<div className="mt-3 flex items-center justify-center gap-3">
						<div className="flex items-center gap-1.5">
							{notes.map((n, i) => (
								<button
									key={n.id}
									type="button"
									onClick={() => goTo(i)}
									aria-label={`第 ${i + 1} 条`}
									className="h-1.5 rounded-full transition-all duration-300 active:scale-[0.9]"
									style={{
										width: i === index ? 18 : 6,
										background: i === index
											? "oklch(var(--primary))"
											: "oklch(var(--muted-foreground) / 0.3)",
									}}
								/>
							))}
						</div>
						<span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
							{index + 1} / {total}
						</span>
					</div>
				</>
			)}
		</div>
	);
}
