"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

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

/** 阶段文案：随动画进度推进切换（加载中弱化展示，落定后消失） */
function phaseFor(progress: number): string {
	if (progress < 0.18) return "启动中";
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
			className="relative mx-auto mb-8 max-w-[420px] overflow-hidden rounded-[20px] border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 px-5 py-6 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.1)] sm:py-7"
		>
			{/* 背景径向辉光（克制，非霓虹） */}
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(var(--primary)/0.06),transparent_60%)]" />

			<div className="relative z-10 flex flex-col items-center gap-4">
				{/* 翻牌时钟：核心视觉，居中 */}
				<div className="flex items-center gap-2 sm:gap-3">
					<FlipUnit value={year} label="YEAR" />
					<span className="-mt-4 font-mono text-xl text-border/80">/</span>
					<FlipUnit value={month} label="MON" />
					<span className="-mt-4 font-mono text-xl text-border/80">/</span>
					<FlipUnit value={day} label="DAY" />
				</div>

				{/* 弱化的阶段文案：仅加载中展示，落定后自动消失（页面刷新后不残留） */}
				<AnimatePresence>
					{!settled && (
						<motion.span
							key={phase}
							initial={{ opacity: 0, y: 2 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -2 }}
							transition={{ duration: 0.2 }}
							className="text-[11px] font-normal text-muted-foreground/50"
						>
							{phase}
							<span className="ml-0.5 inline-block animate-pulse">…</span>
						</motion.span>
					)}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
