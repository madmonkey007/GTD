"use client";

import { AlertCircle, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ToolCallStep } from "@/apps/chat/types";
import { removeThinkingTags } from "@/apps/chat/components/message/utils/messageContentUtils";
import { cn } from "@/lib/utils";

type ToolCallStepsProps = {
	steps: ToolCallStep[];
	className?: string;
};

/**
 * 工具调用步骤列表组件
 * 显示 Agent 执行过程中的每个工具调用步骤
 */
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

/**
 * 单个工具调用步骤项
 */
function ToolCallStepItem({ step, t }: ToolCallStepItemProps) {
	const { toolName, toolArgs, status, resultPreview } = step;

	// 获取工具的本地化名称，如果没有翻译则使用原始工具名
	const toolKey = `tools.${toolName}` as Parameters<typeof t>[0];
	const displayName = t.has(toolKey) ? t(toolKey) : toolName;

	// 状态图标
	const StatusIcon = {
		running: Loader2,
		completed: Loader2,
		error: AlertCircle,
	}[status];

	// 状态颜色
	const statusColorClass = {
		running: "text-[#7E7D79]",
		completed: "text-[#7E7D79]",
		error: "text-red-500",
	}[status];

	// 边框颜色
	const borderColorClass = {
		running: "border-border/40",
		completed: "border-border/40",
		error: "border-red-200 dark:border-red-800",
	}[status];

	// 背景颜色
	const bgColorClass = {
		running: "bg-transparent",
		completed: "bg-transparent",
		error: "bg-transparent",
	}[status];

	// 格式化工具参数显示
	const formatArgs = (args: Record<string, unknown> | undefined): string => {
		if (!args || Object.keys(args).length === 0) {
			return "";
		}
		// 只显示前几个关键参数
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
				"flex items-start gap-2 p-2 rounded-lg border transition-all duration-200 border-border/40",
				borderColorClass,
				bgColorClass,
			)}
		>
			{/* 工具图标 */}
			<div
				className={cn(
					"shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
					status === "running" ? "bg-primary/10 dark:bg-primary/25" : "",
					status === "completed" ? "bg-transparent" : "",
					status === "error" ? "bg-transparent" : "",
				)}
			>
				<StatusIcon className={cn("w-4 h-4", statusColorClass, status === "running" && "animate-spin")} />
			</div>

			{/* 内容区域 */}
			<div className="flex-1 min-w-0">
				{/* 标题行 */}
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm text-[#7E7D79]">
						{status === "running"
							? t("calling", { tool: displayName })
							: status === "completed"
								? t("completed", { tool: displayName })
								: t("failed", { tool: displayName })}
					</span>
					<StatusIcon
						className={cn(
							"w-4 h-4 shrink-0",
							statusColorClass,
							status === "running" && "animate-spin",
						)}
					/>
				</div>

				{/* 参数显示 */}
				{toolArgs && Object.keys(toolArgs).length > 0 && (
					<div className="mt-1 text-xs text-[#7E7D79] font-mono truncate">
						{formatArgs(toolArgs)}
					</div>
				)}

				{/* 结果预览（完成或错误状态） */}
				{(status === "completed" || status === "error") && resultPreview && (
					<div className="mt-2 text-xs text-[#7E7D79] rounded p-2 max-h-20 overflow-auto">
						<span className="text-[#7E7D79]">
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
