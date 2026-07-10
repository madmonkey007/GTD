import { AtSign, Send, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { LinkedNotes } from "./LinkedNotes";

type InputBoxProps = {
	inputValue: string;
	placeholder: string;
	isStreaming: boolean;
	locale: string;
	onChange: (value: string) => void;
	onSend: () => void;
	onStop?: () => void;
	onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onCompositionStart: () => void;
	onCompositionEnd: () => void;
	onAtClick?: () => void;
	onSlashTyped?: () => void;
	linkedTodos?: React.ReactNode;
	/** 最大高度，默认为 "40vh"（视口高度的40%） */
	maxHeight?: string;
};

/** textarea 的最小行高（像素） */
const MIN_TEXTAREA_HEIGHT = 24;
/** 单行模式下 textarea 的行数 */
const SINGLE_LINE_ROWS = 1;
/** 多行模式下 textarea 的默认行数 */


export function InputBox({
	inputValue,
	placeholder,
	isStreaming,
	onChange,
	onSend,
	onStop,
	onKeyDown,
	onCompositionStart,
	onCompositionEnd,
	onAtClick,
	onSlashTyped,
	linkedTodos,
	locale = "en",
	maxHeight = "40vh",
}: InputBoxProps) {
	const t = useTranslations("chat");
	const isSendDisabled = !inputValue.trim() || isStreaming;
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const prevInputValueRef = useRef<string>(inputValue);

	// 始终使用紧凑布局（单行）
	const isCompactLayout = true;

	/** 自动调整 textarea 高度 — 只在内容真正变化时调整 */
	const adjustHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea || !isCompactLayout) return;

		// 固定到 MIN_TEXTAREA_HEIGHT 再判断是否需要展开
		if (textarea.scrollHeight <= MIN_TEXTAREA_HEIGHT) {
			textarea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
			return;
		}
		textarea.style.height = "auto";
		textarea.style.height = `${textarea.scrollHeight}px`;
	}, []);

	// 只在 inputValue 变化时调整高度
	useLayoutEffect(() => {
		if (prevInputValueRef.current !== inputValue) {
			prevInputValueRef.current = inputValue;
			adjustHeight();
		}
	}, [inputValue, adjustHeight]);

	// 组件挂载时调整一次
	useEffect(() => {
		adjustHeight();
	}, [adjustHeight]);

	// 处理输入变化
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onChange(e.target.value);
		},
		[onChange],
	);

	// 右侧按钮组（@ 按钮和发送/停止按钮）
	const actionButtons = (
		<div className="flex items-center gap-1">
			<button
				type="button"
				onClick={onAtClick}
				className={cn(
					"flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
					"hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				)}
				aria-label={t("mentionFileOrTodo")}
			>
				<AtSign className="h-4 w-4" />
			</button>

			{isStreaming && onStop ? (
				<button
					type="button"
					onClick={onStop}
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-lg",
						"bg-primary text-primary-foreground transition-colors",
						"hover:bg-primary/90",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
					aria-label={t("stop")}
				>
					<Square className="h-4 w-4 fill-current" />
				</button>
			) : (
				<button
					type="button"
					onClick={onSend}
					disabled={isSendDisabled}
					className={cn(
						"flex h-8 w-8 items-center justify-center rounded-lg",
						"bg-primary text-primary-foreground transition-colors",
						"hover:bg-primary/90",
						"disabled:cursor-not-allowed disabled:opacity-50",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
					aria-label={t("send")}
				>
					<Send className="h-4 w-4" />
				</button>
			)}
		</div>
	);

	// 紧凑布局：输入框和按钮在同一行
	if (isCompactLayout) {
		return (
			<div
				className={cn(
					"flex flex-col rounded-xl border border-border/40",
					"bg-background px-3.5 py-2.5 transition-all duration-200",
					"focus-within:border-primary/30 focus-within:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]",
				)}
			>
				{/* 关联待办区域 */}
				{linkedTodos}

				{/* 关联笔记区域 */}
				<LinkedNotes locale={locale} />

				{/* 单行布局：输入框和按钮在同一行 */}
				<div className="flex items-center gap-2">
					{/* 中间：输入框 */}
					<textarea
						ref={textareaRef}
						value={inputValue}
						onChange={handleChange}
						onCompositionStart={onCompositionStart}
						onCompositionEnd={onCompositionEnd}
						onKeyDown={(e) => {
							if (e.key === "/" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
								e.preventDefault();
								onSlashTyped?.();
								return;
							}
							onKeyDown(e);
						}}
						placeholder={placeholder}
						rows={SINGLE_LINE_ROWS}
						style={{ maxHeight, minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}
						className={cn(
							"flex-1 resize-none bg-transparent text-sm text-foreground/80 placeholder:text-muted-foreground/40",
							"focus-visible:outline-none overflow-y-auto leading-relaxed",
						)}
					/>

					{/* 右侧：按钮组 */}
					{actionButtons}
				</div>
			</div>
		);
	}


}
