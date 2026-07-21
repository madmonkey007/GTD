import { Loader2, MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ExtractionState } from "@/apps/chat/hooks/useMessageExtraction";
import type { ChatMessage } from "@/apps/chat/types";
import { cn } from "@/lib/utils";
import { MessageContent } from "./MessageContent";
import { MessageTodoExtractionPanel } from "./MessageTodoExtractionPanel";
import { ToolCallLoading } from "./ToolCallLoading";
import { ToolCallSteps } from "./ToolCallSteps";
import {
	extractToolCalls,
	removeToolCalls,
	removeToolEvents,
	removeThinkingTags,
} from "./utils/messageContentUtils";

type MessageItemProps = {
	message: ChatMessage;
	isLastMessage: boolean;
	isStreaming: boolean;
	typingText: string;
	extractionState?: ExtractionState;
	onRemoveExtractionState: () => void;
	onMenuButtonClick: (event: React.MouseEvent, messageId: string) => void;
	onMessageBoxRef: (messageId: string, ref: HTMLDivElement | null) => void;
};

export function MessageItem({
	message,
	isLastMessage,
	isStreaming,
	typingText,
	extractionState,
	onRemoveExtractionState,
	onMenuButtonClick,
	onMessageBoxRef,
}: MessageItemProps) {
	const tContextMenu = useTranslations("contextMenu");
	const [hovered, setHovered] = useState(false);
	const outerClass = message.role === "assistant" ? "w-full" : "max-w-[80%]";

	const sanitizedContent = message.content
		? removeThinkingTags(removeToolEvents(message.content))
		: "";
	// 检测工具调用标记（在消息渲染前）
	const toolCalls = sanitizedContent ? extractToolCalls(sanitizedContent) : [];
	// 移除工具调用和思考标记后的内容
	const contentWithoutToolCalls = sanitizedContent
		? removeToolCalls(sanitizedContent)
		: "";

	// 获取新的工具调用步骤（来自 toolCallSteps 属性）
	const toolCallSteps = message.toolCallSteps || [];
	const hasToolCallSteps = toolCallSteps.length > 0;

	// 判断是否是正在等待首次回复的空 assistant 消息
	const isEmptyStreaming =
		isStreaming &&
		isLastMessage &&
		message.role === "assistant" &&
		!contentWithoutToolCalls.trim();

	// 跳过没有内容的非 streaming assistant 消息
	if (
		!contentWithoutToolCalls.trim() &&
		message.role === "assistant" &&
		!isEmptyStreaming
	) {
		return null;
	}

	// 是否为 assistant 消息且有内容
	const isAssistantWithContent =
		message.role === "assistant" &&
		contentWithoutToolCalls.trim() &&
		!isEmptyStreaming;

	// 处理消息菜单按钮点击
	const handleMessageMenuClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		onMenuButtonClick(event, message.id);
	};

	// 使用 ref callback 来传递 ref
	const handleMessageBoxRef = (el: HTMLDivElement | null) => {
		onMessageBoxRef(message.id, el);
	};

	return (
		<div
			className={cn(
				"flex flex-col",
				message.role === "assistant" ? "items-start" : "items-end",
			)}
		>
			{/* 没有 toolCallSteps 且空的 streaming 消息 → 显示 loading 指示器 */}
			{isEmptyStreaming && !hasToolCallSteps ? (
				<div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin text-primary/60" />
					{typingText}
				</div>
			) : (
				<div className={outerClass}>
					{/* 工具调用步骤（始终固定在气泡上方，不随流式状态切换 DOM） */}
					{message.role === "assistant" && hasToolCallSteps && (
						<ToolCallSteps steps={toolCallSteps} className="mb-2" />
					)}

					{/* 空的 streaming + 有 toolCallSteps → 只显示工具步骤，不显示空气泡 */}
					{isEmptyStreaming && hasToolCallSteps ? null : (
						<div
							ref={handleMessageBoxRef}
							role="group"
							className={cn(
								"relative rounded-2xl px-4 py-3 text-sm",
								message.role === "assistant"
									? "bg-muted/25 text-foreground border border-border/30"
									: "bg-primary/8 text-foreground border border-primary/10",
							)}
							onMouseEnter={() => {
								if (isAssistantWithContent) {
									setHovered(true);
								}
							}}
							onMouseLeave={() => {
								setHovered(false);
							}}
						>
							<div className="leading-relaxed relative">
								{hovered && isAssistantWithContent && (
									<button
										type="button"
										onClick={handleMessageMenuClick}
										className="absolute -bottom-1 -right-1 opacity-70 hover:opacity-100 transition-opacity rounded-full p-1.5 bg-background/80 hover:bg-background shadow-sm border border-border/50"
										aria-label={tContextMenu("extractButton")}
									>
										<MoreVertical className="h-3.5 w-3.5" />
									</button>
								)}
								<MessageContent message={message} />
							</div>
						</div>
					)}
				</div>
			)}
			{/* 提取待办面板 - 显示在消息下方 */}
			{extractionState && (
				<div
					className={cn(
						"w-full",
						message.role === "assistant" ? "w-full" : "max-w-[80%]",
					)}
				>
					<MessageTodoExtractionPanel
						todos={extractionState.todos}
						parentTodoId={extractionState.parentTodoId}
						isExtracting={extractionState.isExtracting}
						onComplete={onRemoveExtractionState}
					/>
				</div>
			)}
		</div>
	);
}
