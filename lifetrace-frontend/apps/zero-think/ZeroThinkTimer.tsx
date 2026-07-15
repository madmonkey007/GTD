"use client";

import { motion } from "framer-motion";
import { TIMER_DURATION_SECONDS, TIMER_WARNING_THRESHOLD } from "./constants";

interface ZeroThinkTimerProps {
	timeRemaining: number;
	totalTime?: number;
	isWarning?: boolean;
}

export function ZeroThinkTimer({
	timeRemaining,
	totalTime = TIMER_DURATION_SECONDS,
	isWarning = timeRemaining <= TIMER_WARNING_THRESHOLD,
}: ZeroThinkTimerProps) {
	const radius = 40;
	const circumference = 2 * Math.PI * radius;
	const progress = (totalTime - timeRemaining) / totalTime;
	const strokeDashoffset = circumference * (1 - progress);

	const isExpired = timeRemaining <= 0;
	const displayTime = Math.max(0, timeRemaining);

	return (
		<div className="relative flex items-center justify-center">
			<svg
				width="100"
				height="100"
				viewBox="0 0 100 100"
				className="transform -rotate-90 text-border"
				role="img"
				aria-label="倒计时器"
			>
				<title>倒计时器</title>
				{/* Background circle */}
				<circle
					cx="50"
					cy="50"
					r={radius}
					stroke="currentColor"
					strokeWidth="6"
					fill="none"
				/>
				{/* Progress circle */}
				<motion.circle
					cx="50"
					cy="50"
					r={radius}
					stroke={isExpired
						? "rgb(239, 68, 68)"
						: isWarning
							? "rgb(251, 191, 36)"
							: "rgb(251, 191, 36)"}
					strokeWidth="6"
					fill="none"
					strokeLinecap="round"
					strokeDasharray={circumference}
					initial={{ strokeDashoffset: circumference }}
					animate={{ strokeDashoffset }}
					transition={{ duration: 0.5, ease: "easeOut" }}
				/>
			</svg>
			{/* Center display */}
			<div className="absolute inset-0 flex items-center justify-center">
				{isExpired ? (
					<motion.div
						className="font-mono text-2xl font-semibold text-red-400 tabular-nums"
						animate={{ opacity: [1, 0.5, 1] }}
						transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
					>
						0
					</motion.div>
				) : (
					<motion.div
						className={`font-mono text-3xl font-semibold tabular-nums ${
							isWarning ? "text-primary" : "text-foreground"
						}`}
						animate={
							isWarning
								? { scale: [1, 1.05, 1] }
								: {}
						}
						transition={{
							duration: 1,
							repeat: Infinity,
							ease: "easeInOut",
						}}
					>
						{displayTime}
					</motion.div>
				)}
			</div>
		</div>
	);
}
