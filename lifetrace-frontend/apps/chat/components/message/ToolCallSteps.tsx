"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ToolCallStep } from "@/apps/chat/types";
import { removeThinkingTags } from "@/apps/chat/components/message/utils/messageContentUtils";
import { cn } from "@/lib/utils";

type ToolCallStepsProps = {
	steps: ToolCallStep[];
	className?: string;
};

export function ToolCallSteps({ steps, className }: ToolCallStepsProps) {
	const t = useTranslations("chat.toolCall");

	if (!steps || steps.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-col gap-2 mb-3", className)}>
			{steps.map((step) => (
				<ToolCallStepItem key={step.id} step={step} t={t} />
			))}
		</div>
	);
}

type ToolCallStepItemProps = {
	step: ToolCallStep;
	t: ReturnType<typeof useTranslations<"chat.toolCall">>;
};

function ToolCallStepItem({ step, t }: ToolCallStepItemProps) {
	const { toolName, toolArgs, status, resultPreview } = step;

	const toolKey = `tools.${toolName}` as Parameters<typeof t>[0];
	const displayName = t.has(toolKey) ? t(toolKey) : toolName;

	const StatusIcon = {
		running: Loader2,
		completed: CheckCircle2,
		error: AlertCircle,
	}[status];

	const formatArgs = (args: Record<string, unknown> | undefined): string => {
		if (!args || Object.keys(args).length === 0) {
			return "";
		}
		const entries = Object.entries(args).slice(0, 3);
		return entries
			.map(([key, value]) => {
				const strValue =
					typeof value === "string"
						? value.length > 50
							? `${value.substring(0, 50)}...`
							: value
						: JSON.stringify(value);
				return `${key}: ${strValue}`;
			})
			.join(", ");
	};

	return (
		<div
			className={cn(
				"flex items-start gap-2 p-2 rounded-lg border transition-all duration-200",
				status === "running"
					? "border-border/60 bg-muted/30"
					: status === "completed"
						? "border-border/60 bg-muted/30"
						: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20",
			)}
		>
			<div
				className={cn(
					"shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
					status === "running" ? "bg-primary/10 dark:bg-primary/25" : "bg-muted/20",
				)}
			>
				<StatusIcon
					className={cn(
						"w-4 h-4",
						status === "running"
							? "text-primary"
							: status === "completed"
								? "text-emerald-600 dark:text-emerald-400"
								: "text-red-500",
						status === "running" && "animate-spin",
					)}
				/>
			</div>

			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm text-foreground">
						{status === "running"
							? t("calling", { tool: displayName })
							: status === "completed"
								? t("completed", { tool: displayName })
								: t("failed", { tool: displayName })}
					</span>
					<StatusIcon
						className={cn(
							"w-4 h-4 shrink-0",
							status === "running"
								? "text-primary"
								: status === "completed"
									? "text-emerald-600 dark:text-emerald-400"
									: "text-red-500",
							status === "running" && "animate-spin",
						)}
					/>
				</div>

				{toolArgs && Object.keys(toolArgs).length > 0 && (
					<div className="mt-1 text-xs text-foreground font-mono truncate">
						{formatArgs(toolArgs)}
					</div>
				)}

				{(status === "completed" || status === "error") && resultPreview && (
					<div className="mt-2 text-xs text-muted-foreground rounded bg-muted/20 p-2 max-h-20 overflow-auto">
						<span className="text-foreground">
							{t("result")}:
						</span>{" "}
						{resultPreview.length > 200
							? `${removeThinkingTags(resultPreview).substring(0, 200)}...`
							: removeThinkingTags(resultPreview)}
					</div>
				)}
			</div>
		</div>
	);
}
