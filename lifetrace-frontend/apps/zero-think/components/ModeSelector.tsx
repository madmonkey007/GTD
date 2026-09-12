"use client";

import { motion } from "framer-motion";
import { Sparkles, Target } from "lucide-react";
import { useLocaleStore } from "@/lib/store/locale";

interface ModeSelectorProps {
	selectedMode: "scattered" | "batch";
	onSelectMode: (mode: "scattered" | "batch") => void;
}

export function ModeSelector({
	selectedMode,
	onSelectMode,
}: ModeSelectorProps) {
	const isZh = useLocaleStore((s) => s.locale) === "zh";
	const modes = [
		{
			id: "scattered" as const,
			icon: Sparkles,
			title: isZh ? "碎片化思考" : "Scattered thinking",
			description: isZh ? "随时随地，一个问题一分钟" : "Anytime, one question a minute",
		},
		{
			id: "batch" as const,
			icon: Target,
			title: isZh ? "批量专注" : "Batch focus",
			description: isZh ? "坐下来，连续完成10个问题" : "Sit down and finish 10 questions in a row",
		},
	];

	return (
		<div className="w-full">
			<h2 className="text-sm font-medium text-muted-foreground mb-4">
				{isZh ? "选择思考模式" : "Choose a thinking mode"}
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
