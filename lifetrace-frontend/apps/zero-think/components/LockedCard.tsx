"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { ZeroThinkCard } from "../types";

interface LockedCardProps {
	card: ZeroThinkCard;
}

export function LockedCard({ card }: LockedCardProps) {
	const formatDuration = (ms: number) => {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return minutes > 0
			? `${minutes}分${remainingSeconds}秒`
			: `${seconds}秒`;
	};

	const formatTime = (isoString: string) => {
		const date = new Date(isoString);
		return date.toLocaleTimeString("zh-CN", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
			className="bg-card border border-border rounded-xl p-6 opacity-70"
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Lock size={14} strokeWidth={1.5} />
					<span className="text-xs font-medium">已锁定</span>
				</div>
				<div className="text-xs text-muted-foreground tabular-nums">
					{formatTime(card.createdAt)}
				</div>
			</div>

			{/* Question */}
			<h3 className="text-sm font-medium text-foreground mb-4">
				{card.question}
			</h3>

			{/* Answers */}
			<div className="space-y-2 mb-4">
				{card.answers.map((answer, index) => (
					<div
						key={index}
						className="flex items-start gap-2 text-muted-foreground"
					>
						<span className="text-muted-foreground mt-0.5 font-mono text-xs">{index + 1}.</span>
						<span className="text-sm">{answer}</span>
					</div>
				))}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
				<span className="tabular-nums">耗时 {formatDuration(card.durationMs)}</span>
				<span>
					{card.mode === "scattered" ? "碎片化思考" : "批量专注"}
				</span>
			</div>
		</motion.div>
	);
}
