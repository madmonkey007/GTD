"use client";

import { Hammer, Sparkles, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

type PromptSuggestion = {
	id: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	prompt: string;
};

type PromptSuggestionsProps = {
	onSelect: (prompt: string) => void;
	className?: string;
};

export function PromptSuggestions({
	onSelect,
	className,
}: PromptSuggestionsProps) {
	const t = useTranslations("chat");

	const suggestions: PromptSuggestion[] = [
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
		(prompt: string) => {
			onSelect(prompt);
		},
		[onSelect],
	);

	return (
		<div className={cn("flex flex-wrap justify-center gap-2 px-4", className)}>
			{suggestions.map((suggestion) => {
				const Icon = suggestion.icon;
				return (
					<button
						key={suggestion.id}
						type="button"
						onClick={() => handleClick(suggestion.prompt)}
						className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
					>
						<Icon className="h-3.5 w-3.5" />
						<span>{suggestion.label}</span>
					</button>
				);
			})}
		</div>
	);
}
