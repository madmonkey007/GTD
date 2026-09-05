"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BreakdownQuestionnaireModal } from "@/apps/chat/components/breakdown/BreakdownQuestionnaireModal";
import { BreakdownStageRenderer } from "@/apps/chat/components/breakdown/BreakdownStageRenderer";
import { ChatInputSection } from "@/apps/chat/components/input/ChatInputSection";

import { HeaderBar } from "@/apps/chat/components/layout/HeaderBar";
import { HistoryDrawer } from "@/apps/chat/components/layout/HistoryDrawer";
import { MessageList } from "@/apps/chat/components/message/MessageList";
import { ProcessInboxChat } from "@/apps/chat/components/process-inbox/ProcessInboxChat";
import { useBreakdownQuestionnaire } from "@/apps/chat/hooks/useBreakdownQuestionnaire";
import { useChatController } from "@/apps/chat/hooks/useChatController";
import { useChatStore } from "@/lib/store/chat-store";
import { useProcessInboxStore } from "@/lib/store/process-inbox-store";
import { useLocaleStore } from "@/lib/store/locale";
import { useTodoStore } from "@/lib/store/todo-store";

export function ChatPanel() {
	const { locale } = useLocaleStore();
	const tChat = useTranslations("chat");
	const tPage = useTranslations("page");

	// 从 Zustand 获取 UI 状态
	const { selectedTodoIds, toggleTodoSelection } =
		useTodoStore();

	// 获取 pendingPrompt（其他组件触发的待发送消息）
	const { pendingPrompt, pendingNewChat, setPendingPrompt } = useChatStore();

	// 使用 Breakdown Questionnaire hook
	const breakdownQuestionnaire = useBreakdownQuestionnaire();

	// 使用 Chat Controller hook
	const chatController = useChatController({
		locale,
		selectedTodoIds,
	});

	// 处理预设 Prompt 选择：直接发送消息（复用 sendMessage 逻辑）
	const handleSelectPrompt = useCallback(
		(prompt: string) => {
			void chatController.sendMessage(prompt);
		},
		[chatController],
	);

	// 监听 pendingPrompt 变化，自动发送消息（由其他组件触发，如 TodoCard 的"获取建议"按钮）
	useEffect(() => {
		if (pendingPrompt) {
			// 如果需要新开会话，先清空当前会话（keepStreaming=true 让旧的流式输出继续在后台运行）
			if (pendingNewChat) {
				chatController.handleNewChat(true);
			}
			// 使用 setTimeout 确保新会话状态已更新后再发送消息
			setTimeout(() => {
				void chatController.sendMessage(pendingPrompt);
			}, 0);
			// 清空 pendingPrompt，避免重复发送
			setPendingPrompt(null);
		}
	}, [pendingPrompt, pendingNewChat, chatController, setPendingPrompt]);

	const [showTodosExpanded, setShowTodosExpanded] = useState(false);

	// GTD 整理收集箱会话激活时隐藏聊天背景（欢迎语、建议按钮），只留提问对话
	const processInboxActive = useProcessInboxStore((s) => s.active);
	const startProcessInbox = useProcessInboxStore((s) => s.start);

	// chat 面板内的「整理收集箱」建议按钮：直接开启 GTD 五问会话
	const handleProcessInbox = useCallback(() => {
		startProcessInbox();
	}, [startProcessInbox]);

	const typingText = useMemo(() => tChat("aiThinking"), [tChat]);

	const formatMessageCount = useCallback(
		(count?: number) => tPage("messagesCount", { count: count ?? 0 }),
		[tPage],
	);

	// 判断是否显示首页（用于在输入框上方显示建议按钮）

	return (
		<div className="flex h-full flex-col bg-background">
			<HeaderBar
				chatHistoryLabel={tPage("chatHistory")}
				newChatLabel={tPage("newChat")}
				onToggleHistory={() =>
					chatController.setHistoryOpen(!chatController.historyOpen)
				}
				onNewChat={chatController.handleNewChat}

				/>

			{chatController.historyOpen && (
				<HistoryDrawer
					historyLoading={chatController.historyLoading}
					historyError={chatController.historyError}
					sessions={chatController.sessions}
					conversationId={chatController.conversationId}
					formatMessageCount={formatMessageCount}
					labels={{
						recentSessions: tPage("recentSessions"),
						noHistory: tPage("noHistory"),
						loading: tChat("loading"),
						chatHistory: tPage("chatHistory"),
					}}
					onSelectSession={chatController.handleLoadSession}
				/>
			)}

			{/* 内容区：消息列表始终渲染，弹窗以浮层形式覆盖其上 */}
			<div className="relative flex min-h-0 flex-1 flex-col">
				{!processInboxActive && (
					<MessageList
						messages={chatController.messages}
						isStreaming={chatController.isStreaming}
						typingText={typingText}
						effectiveTodos={chatController.effectiveTodos}
						onSelectPrompt={handleSelectPrompt}
						onProcessInbox={handleProcessInbox}
					/>
				)}

				{/* 浮动弹窗：问卷 / 总结 / 流式生成，覆盖消息区、底部贴入输入框 */}
				{!processInboxActive && breakdownQuestionnaire.stage !== "idle" && (
					<div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end overflow-y-auto">
						{breakdownQuestionnaire.stage === "questionnaire" &&
							breakdownQuestionnaire.questions.length > 0 ? (
							<div className="pointer-events-auto w-full px-4 pb-1">
								<BreakdownQuestionnaireModal
									questions={breakdownQuestionnaire.questions}
									answers={breakdownQuestionnaire.answers}
									onAnswerChange={breakdownQuestionnaire.setAnswer}
									onSubmit={breakdownQuestionnaire.handleSubmitAnswers}
									isSubmitting={breakdownQuestionnaire.isGeneratingSummary}
									onClose={breakdownQuestionnaire.handleCancelBreakdown}
								/>
							</div>
						) : (
							<div className="pointer-events-auto w-full px-4 pb-1">
								<BreakdownStageRenderer
									stage={breakdownQuestionnaire.stage}
									questions={breakdownQuestionnaire.questions}
									summary={breakdownQuestionnaire.summary}
									subtasks={breakdownQuestionnaire.subtasks}
									breakdownLoading={breakdownQuestionnaire.breakdownLoading}
									isGeneratingSummary={breakdownQuestionnaire.isGeneratingSummary}
									summaryStreamingText={breakdownQuestionnaire.summaryStreamingText}
									isGeneratingQuestions={breakdownQuestionnaire.isGeneratingQuestions}
									questionStreamingCount={breakdownQuestionnaire.questionStreamingCount}
									questionStreamingTitle={breakdownQuestionnaire.questionStreamingTitle}
									breakdownError={breakdownQuestionnaire.breakdownError}
									locale={locale}
									onAccept={breakdownQuestionnaire.handleAcceptBreakdown}
								/>
							</div>
						)}
					</div>
					)}

				{/* GTD inbox processing: floating overlay inside the relative content area, docked above input */}
				{processInboxActive && (
					<div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end overflow-y-auto">
						<div className="pointer-events-auto w-full px-4 pb-1">
							<ProcessInboxChat />
						</div>
					</div>
				)}
			</div>
			<ChatInputSection
				locale={locale}
				inputValue={chatController.inputValue}
				isStreaming={chatController.isStreaming}
				error={chatController.error}
				effectiveTodos={chatController.effectiveTodos}
				showTodosExpanded={showTodosExpanded}
				onInputChange={chatController.setInputValue}
				onSend={chatController.handleSend}
				onStop={chatController.handleStop}
				onKeyDown={chatController.handleKeyDown}
				onCompositionStart={() => chatController.setIsComposing(true)}
				onCompositionEnd={() => chatController.setIsComposing(false)}
				onToggleExpand={() => setShowTodosExpanded((prev) => !prev)}
				onToggleTodo={toggleTodoSelection}

onTranscript={(text) => chatController.setInputValue((prev) => (prev ? prev + " " + text : text))}
/>
		</div>
	);
}
