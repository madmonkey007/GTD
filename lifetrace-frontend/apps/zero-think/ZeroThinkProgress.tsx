"use client";

import { motion } from "framer-motion";

interface ZeroThinkProgressProps {
	completed: number;
	total?: number;
}

export function ZeroThinkProgress({
	completed,
	total = 10,
}: ZeroThinkProgressProps) {
	const percentage = (completed / total) * 100;

	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-2">
			<span className="text-xs text-muted-foreground">
				今日进度
			</span>
			<span className="text-xs text-muted-foreground tabular-nums">
					{completed}/{total}
				</span>
			</div>
			<div className="h-1.5 bg-muted rounded-full overflow-hidden">
				<motion.div
					className="h-full bg-primary rounded-full"
					initial={{ width: 0 }}
					animate={{ width: `${percentage}%` }}
					transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
				/>
			</div>
		</div>
	);
}
