"use client";

import { useEffect, useRef, useState } from "react";

interface TimeMachineHeaderProps {
	/** 穿越到的目标日期 */
	target: Date;
	/** 退出时光机（清除筛选） */
	onClose: () => void;
}

/** 缓动函数：先快后慢（ease-out cubic） */
function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

/**
 * 时光机头部：标题「时光机」+ 副标题「今天穿越回到了 XXXX 年 XX 月 XX 日」。
 * 年/月/日数字从今天开始飞速转动，先快后慢，最后落到目标日期。
 */
export function TimeMachineHeader({ target, onClose }: TimeMachineHeaderProps) {
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
	const [settled, setSettled] = useState(false);

	const rafRef = useRef<number>(0);
	const startTimeRef = useRef<number>(0);
	const DURATION = 2200; // 总时长 ms：前段快速跳动，后段慢速落定

	useEffect(() => {
		cancelAnimationFrame(rafRef.current);
		setSettled(false);
		startTimeRef.current = 0;

		const tick = (ts: number) => {
			if (!startTimeRef.current) startTimeRef.current = ts;
			const elapsed = ts - startTimeRef.current;
			const progress = Math.min(elapsed / DURATION, 1);
			const eased = easeOutCubic(progress);

			// 在未落定前，数字在目标值附近上下快速抖动；随 progress 增大逐渐收敛
			// 抖动幅度随 eased 衰减：从大范围缩到 0
			const jitterRange = Math.max(1, Math.round((1 - eased) * 6));

			const rand = (range: number) =>
				Math.floor((Math.random() * 2 - 1) * range);

			setYear(targetYear + rand(jitterRange * 2));
			// 月份/日期需 clamp 到合法范围
			setMonth(Math.max(1, Math.min(12, targetMonth + rand(jitterRange))));
			setDay(Math.max(1, Math.min(28, targetDay + rand(jitterRange))));

			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				setYear(targetYear);
				setMonth(targetMonth);
				setDay(targetDay);
				setSettled(true);
			}
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [targetYear, targetMonth, targetDay]);

	return (
		<div className="mb-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent px-4 py-3">
			<div className="flex items-center justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-1.5">
						<span className="text-sm font-semibold text-foreground">
							时光机
						</span>
						{!settled && (
							<span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary/60" />
						)}
					</div>
					<p className="mt-0.5 text-xs text-muted-foreground/80">
						今天穿越回到了{" "}
						<span
							className={`inline-flex items-baseline gap-0.5 font-medium tabular-nums transition-colors ${
								settled ? "text-primary" : "text-foreground/70"
							}`}
						>
							<span>{year}</span>
							<span className="text-muted-foreground/50">年</span>
							<span className="w-6 text-center">{month}</span>
							<span className="text-muted-foreground/50">月</span>
							<span className="w-5 text-center">{day}</span>
							<span className="text-muted-foreground/50">日</span>
						</span>
					</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
				>
					返回
				</button>
			</div>
		</div>
	);
}
