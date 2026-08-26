"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

/** 日历/四象限视图右上角铺满/还原按钮：铺满时隐藏左侧筛选栏 */
export function ViewExpandButton({ className }: { className?: string }) {
	const viewExpanded = useUiStore((s) => s.viewExpanded);
	const setViewExpanded = useUiStore((s) => s.setViewExpanded);
	const Icon = viewExpanded ? Minimize2 : Maximize2;
	return (
		<button
			type="button"
			onClick={() => setViewExpanded(!viewExpanded)}
			title={viewExpanded ? "还原" : "铺满"}
			aria-label={viewExpanded ? "还原" : "铺满"}
			className={cn(
				"flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
		>
			<Icon className="h-4.5 w-4.5" />
		</button>
	);
}
