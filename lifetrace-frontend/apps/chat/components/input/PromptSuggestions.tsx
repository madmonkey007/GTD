"use client";

import {
	Hammer,
	ListChecks,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

type PromptSuggestion = {
	id: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	prompt?: string;
	/** 整理收集箱等非 prompt 动作 */
	action?: () => void;
};

type PromptSuggestionsProps = {
	onSelect: (prompt: string) => void;
	onProcessInbox?: () => void;
	className?: string;
};

export function PromptSuggestions({
	onSelect,
	onProcessInbox,
	className,
}: PromptSuggestionsProps) {
	const t = useTranslations("chat");

	const suggestions: PromptSuggestion[] = [
		{
			id: "processInbox",
			icon: ListChecks,
			label: t("suggestions.processInbox"),
			action: onProcessInbox,
		},
		{
			id: "breakdown",
			icon: Hammer,
			label: t("suggestions.breakdown"),
			prompt: t("suggestions.breakdownPrompt"),
		},
		{
			id: "priority",
			icon: TrendingUp,
			label: t("suggestions.priority"),
			prompt: t("suggestions.priorityPrompt"),
		},
		{
			id: "advice",
			icon: Sparkles,
			label: t("suggestions.advice"),
			prompt: t("suggestions.advicePrompt"),
		},
	];

	const handleClick = useCallback(
		(suggestion: PromptSuggestion) => {
			if (suggestion.action) {
				suggestion.action();
				return;
			}
			if (suggestion.prompt) onSelect(suggestion.prompt);
		},
		[onSelect],
	);

	// 与收集箱面板（QuickCommandPanel）示例按钮保持一致的卡片样式
	return (
		<div
			className={cn(
				"grid grid-cols-2 gap-2 px-4",
				className,
			)}
		>
			{suggestions.map((suggestion) => {
				const Icon = suggestion.icon;
				return (
					<button
						key={suggestion.id}
						type="button"
						onClick={() => handleClick(suggestion)}
						className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.04] hover:shadow-sm active:scale-[0.98]"
					>
						<span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
							<Icon className="h-5 w-5" />
						</span>
						<span className="text-sm font-medium text-foreground">
							{suggestion.label}
						</span>
					</button>
				);
			})}
		</div>
	);
}
