"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface TimeMachineHeaderProps {
	/** 穿越到的目标日期 */
	target: Date;
	/** 动画落定后触发（用于延迟加载该日笔记，确保时间先展示完整） */
	onSettled?: () => void;
}

const DURATION = 2600; // 总时长 ms

/** ease-in-out cubic：先慢后快再慢 */
function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 翻牌时钟单元：浅底深字，数字切换时上滑翻转 */
function FlipUnit({ value, label }: { value: number; label: string }) {
	const padded = String(value).padStart(2, "0");
	return (
		<div className="flex flex-col items-center gap-1">
			<div className="relative h-12 w-9 overflow-hidden rounded-md bg-muted shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] sm:h-14 sm:w-11">
				{/* 中分线：模拟翻页时钟的横向接缝 */}
				<div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2 bg-border/60" />
				<motion.span
					key={padded}
					initial={{ y: "100%", opacity: 0 }}
					animate={{ y: "0%", opacity: 1 }}
					transition={{ type: "spring", stiffness: 260, damping: 24 }}
					className="absolute inset-0 flex items-center justify-center font-mono text-lg font-semibold tabular-nums text-foreground sm:text-xl"
				>
					{padded}
				</motion.span>
			</div>
			<span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/60">
				{label}
			</span>
		</div>
	);
}

/** 阶段文案：随动画进度推进切换 */
function phaseFor(progress: number): string {
	if (progress < 0.18) return "时光机器 · 启动";
	if (progress < 0.42) return "发射";
	if (progress < 0.72) return "时空跃迁中";
	if (progress < 0.94) return "即将着陆";
	return "安全到达";
}

/**
 * 时光机器沉浸式头部。
 *
 * 视觉：黑底白字的翻牌时钟数字（年/月/日），从今天缓动到目标日期。
 * 缓动：ease-in-out cubic（先慢后快再慢）。
 * 文案：启动 → 发射 → 时空跃迁中 → 即将着陆 → 安全到达。
 * 「出发」按钮已移至页面底部（见 DiaryEditor 时光机分支），此处不再渲染。
 */
export function TimeMachineHeader({ target, onSettled }: TimeMachineHeaderProps) {
	const today = new Date();
	const startYear = today.getFullYear();
	const startMonth = today.getMonth() + 1;
	const startDay = today.getDate();

	const targetYear = target.getFullYear();
	const targetMonth = target.getMonth() + 1;
	const targetDay = target.getDate();

	const [year, setYear] = useState(startYear);
	const [month, setMonth] = useState(startMonth);
	const [day, setDay] = useState(startDay);
	const [phase, setPhase] = useState("时光机器 · 启动");
	const [settled, setSettled] = useState(false);

	const rafRef = useRef<number>(0);
	const startTimeRef = useRef<number>(0);
	const onSettledRef = useRef(onSettled);
	onSettledRef.current = onSettled;

	useEffect(() => {
		cancelAnimationFrame(rafRef.current);
		setSettled(false);
		setPhase("时光机器 · 启动");
		startTimeRef.current = 0;

		const tick = (ts: number) => {
			if (!startTimeRef.current) startTimeRef.current = ts;
			const elapsed = ts - startTimeRef.current;
			const progress = Math.min(elapsed / DURATION, 1);
			const eased = easeInOutCubic(progress);

			setYear(Math.round(startYear + (targetYear - startYear) * eased));
			setMonth(Math.round(startMonth + (targetMonth - startMonth) * eased));
			setDay(Math.round(startDay + (targetDay - startDay) * eased));
			setPhase(phaseFor(progress));

			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				setYear(targetYear);
				setMonth(targetMonth);
				setDay(targetDay);
				setPhase("安全到达");
				setSettled(true);
				onSettledRef.current?.();
			}
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [startYear, startMonth, startDay, targetYear, targetMonth, targetDay]);

	const SPRING = { type: "spring" as const, stiffness: 120, damping: 18 };

	return (
		<motion.div
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={SPRING}
			className="relative mb-4 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 px-5 py-4 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.1)]"
		>
			{/* 背景径向辉光（克制，非霓虹） */}
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(var(--primary)/0.05),transparent_60%)]" />

			<div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				{/* 左：标识 + 阶段文案 */}
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2">
						<motion.span
							className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
							animate={settled ? { scale: 1 } : { scale: [1, 1.4, 1] }}
							transition={settled ? { duration: 0.3 } : { duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
						/>
						<span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
							时光机器
						</span>
					</div>
					<motion.span
						key={phase}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25 }}
						className={`text-sm font-medium ${settled ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/80"}`}
					>
						{phase}
						{!settled && (
							<span className="ml-0.5 inline-block animate-pulse">…</span>
						)}
					</motion.span>
				</div>

				{/* 中/右：翻牌时钟（年/月/日） */}
				<div className="flex items-center gap-2 sm:gap-3">
					<FlipUnit value={year} label="YEAR" />
					<span className="-mt-4 font-mono text-xl text-border">/</span>
					<FlipUnit value={month} label="MON" />
					<span className="-mt-4 font-mono text-xl text-border">/</span>
					<FlipUnit value={day} label="DAY" />
				</div>
			</div>

			{/* 底部进度条 */}
			<motion.div
				className="absolute bottom-0 left-0 h-px bg-primary/60"
				initial={{ width: "0%" }}
				animate={{ width: settled ? "100%" : "40%" }}
				transition={
					settled
						? { duration: 0.5, ease: "easeOut" }
						: { duration: 0.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
				}
			/>
		</motion.div>
	);
}
