"use client";

import { motion } from "framer-motion";
import { Sparkles, Target } from "lucide-react";

interface ModeSelectorProps {
	selectedMode: "scattered" | "batch";
	onSelectMode: (mode: "scattered" | "batch") => void;
}

export function ModeSelector({
	selectedMode,
	onSelectMode,
}: ModeSelectorProps) {
	const modes = [
		{
			id: "scattered" as const,
			icon: Sparkles,
			title: "碎片化思考",
			description: "随时随地，一个问题一分钟",
		},
		{
			id: "batch" as const,
			icon: Target,
			title: "批量专注",
			description: "坐下来，连续完成10个问题",
		},
	];

	return (
		<div className="w-full">
			<h2 className="text-sm font-medium text-muted-foreground mb-4">
									选择思考模式
								</h2>

			<div className="bg-muted/50 rounded-2xl p-1 flex gap-1">
				{modes.map((mode) => {
					const isSelected = selectedMode === mode.id;
					const Icon = mode.icon;

					return (
						<motion.button
							key={mode.id}
							onClick={() => onSelectMode(mode.id)}
						className={`relative flex-1 rounded-xl py-3 px-4 text-center transition-all duration-200 ${
							isSelected
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
							whileHover={{ scale: 1.01 }}
							whileTap={{ scale: 0.99 }}
						>
							<div className="flex items-center justify-center gap-2 mb-1">
								<Icon
									size={16}
									strokeWidth={1.5}
									className={isSelected ? "text-primary" : "text-muted-foreground"}
								/>
								<span className="text-sm font-medium">
									{mode.title}
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								{mode.description}
							</p>
						</motion.button>
					);
				})}
			</div>
		</div>
	);
}
