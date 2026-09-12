"use client";

import { motion } from "framer-motion";
import { useLocaleStore } from "@/lib/store/locale";

interface ZeroThinkProgressProps {
	completed: number;
	total?: number;
}

export function ZeroThinkProgress({
	completed,
	total = 10,
}: ZeroThinkProgressProps) {
	const isZh = useLocaleStore((s) => s.locale) === "zh";
	const percentage = (completed / total) * 100;

	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-2">
			<span className="text-xs text-muted-foreground">
				{isZh ? "今日进度" : "Today's progress"}
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
