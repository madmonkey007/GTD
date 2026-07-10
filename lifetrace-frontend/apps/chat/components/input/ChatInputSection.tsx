"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { InputBox } from "@/apps/chat/components/input/InputBox";
import { LinkedTodos } from "@/apps/chat/components/input/LinkedTodos";
import { PromptSuggestions } from "@/apps/chat/components/input/PromptSuggestions";
import { ToolSelector } from "@/apps/chat/components/input/ToolSelector";
import type { Todo } from "@/lib/types";

type ChatInputSectionProps = {
	locale: string;
	inputValue: string;
	isStreaming: boolean;
	error: string | null;
	effectiveTodos: Todo[];
	showTodosExpanded: boolean;
	showSuggestions: boolean;
	onSelectPrompt: (prompt: string) => void;
	onInputChange: (value: string) => void;
	onSend: () => void;
	onStop?: () => void;
	onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onCompositionStart: () => void;
	onCompositionEnd: () => void;
	onToggleExpand: () => void;
	onToggleTodo: (todoId: number) => void;
};

export function ChatInputSection({
	locale,
	inputValue,
	isStreaming,
	error,
	effectiveTodos,
	showTodosExpanded,
	onInputChange,
	onSend,
	onStop,
	onKeyDown,
	onCompositionStart,
	onCompositionEnd,
	onToggleExpand,
	showSuggestions,
	onSelectPrompt,
	onToggleTodo,
}: ChatInputSectionProps) {
	const tPage = useTranslations("page");
	const [showSlashMenu, setShowSlashMenu] = useState(false);
	const slashMenuRef = useRef<HTMLDivElement | null>(null);
	const inputPlaceholder = tPage("chatInputPlaceholder");

	const handleAtClick = useCallback(() => {
		onInputChange(inputValue + "@");
	}, [inputValue, onInputChange]);

	return (
		<div className="bg-background p-4">
			{/* 输入框上方的 PromptSuggestions 弹窗 */}
			{showSuggestions && (
				<div className="pb-3">
					<PromptSuggestions onSelect={onSelectPrompt} />
				</div>
			)}

			{/* 斜杠触发的工具菜单 */}
			{showSlashMenu && (
				<div ref={slashMenuRef} className="mb-2">
					<ToolSelector
						disabled={isStreaming}
						isOpen={showSlashMenu}
						onOpenChange={setShowSlashMenu}
					/>
				</div>
			)}

			<InputBox
				linkedTodos={
					<LinkedTodos
						effectiveTodos={effectiveTodos}
						locale={locale}
						showTodosExpanded={showTodosExpanded}
						onToggleExpand={onToggleExpand}
						onToggleTodo={onToggleTodo}
					/>
				}
				inputValue={inputValue}
				placeholder={inputPlaceholder}
				isStreaming={isStreaming}
				locale={locale}
				onChange={onInputChange}
				onSend={onSend}
				onStop={onStop}
				onKeyDown={onKeyDown}
				onCompositionStart={onCompositionStart}
				onCompositionEnd={onCompositionEnd}
					onAtClick={handleAtClick}
				onSlashTyped={() => setShowSlashMenu(true)}
			/>

			{error && <p className="mt-2 text-sm">{error}</p>}
		</div>
	);
}
