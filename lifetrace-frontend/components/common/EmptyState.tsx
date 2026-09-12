"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	/** 覆盖外层布局（高度/对齐等） */
	className?: string;
}

/**
 * 全局统一的空态展示：圆底线性图标 + 标题 + 副文案。
 * 笔记/待办/习惯等面板的「无内容/无结果」场景共用，保证字体与位置一致。
 */
export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center",
				className,
			)}
		>
			<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 ring-1 ring-border/40">
				<Icon className="h-7 w-7 text-muted-foreground/35" strokeWidth={1.5} />
			</div>
			<div className="space-y-1">
				<p className="text-sm font-medium text-muted-foreground/70">{title}</p>
				{description && (
					<p className="text-xs text-muted-foreground/45">{description}</p>
				)}
			</div>
		</div>
	);
}
