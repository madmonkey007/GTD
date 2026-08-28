import { ArrowUp, AtSign, ListChecks, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useProcessInboxStore } from "@/lib/store/process-inbox-store";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
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
	/** 语音输入回填：录音结束把 final 文本追加到输入框 */
	onTranscript?: (text: string) => void;
	onSlashTyped?: () => void;
	linkedTodos?: React.ReactNode;
	/** @ 提及浮层（由 ChatInputSection 注入） */
	mentionPopover?: React.ReactNode;
	/** textarea 的 ref，供外部定位/插入光标使用 */
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
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
	onTranscript,
	linkedTodos,
	mentionPopover,
	textareaRef: externalTextareaRef,
	locale = "en",
	maxHeight = "40vh",
}: InputBoxProps) {
	const t = useTranslations("chat");
	const isSendDisabled = !inputValue.trim() || isStreaming;
	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = externalTextareaRef ?? internalTextareaRef;
	const prevInputValueRef = useRef<string>(inputValue);

	// 始终使用紧凑布局（单行）
	const isCompactLayout = true;

	/** 自动调整 textarea 高度：先重置为 auto 再读 scrollHeight，避免旧高度污染 */
	const adjustHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea || !isCompactLayout) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.max(MIN_TEXTAREA_HEIGHT, textarea.scrollHeight)}px`;
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

	// 监听 textarea 宽度变化（面板 spring 动画 / resize / 开关都会改变宽度），
	// 宽度稳定后重算高度，避免面板变宽后残留旧的过高高度
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const observer = new ResizeObserver(() => adjustHeight());
		observer.observe(textarea);
		return () => observer.disconnect();
	}, [adjustHeight]);

	// 处理输入变化
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onChange(e.target.value);
		},
		[onChange],
	);

	// 右侧按钮组（@ 按钮和发送/停止按钮）
	const startProcessInbox = useProcessInboxStore((s) => s.start);
	const actionButtons = (
		<div className="flex items-center gap-1">
			{/* GTD 整理收集箱入口：逐条过五问，处理收集箱父待办 */}
			<button
				type="button"
				onClick={() => startProcessInbox()}
				title={locale === "zh" ? "整理收集箱" : "Process inbox"}
				className={cn(
					"flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
					"hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				)}
				aria-label={locale === "zh" ? "整理收集箱" : "Process inbox"}
			>
				<ListChecks className="h-4 w-4" />
			</button>
			{onTranscript && (
				<VoiceInputButton ownerId="chat-input" onTranscript={onTranscript} />
			)}
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
						"flex h-8 w-8 items-center justify-center rounded-full",
						"bg-foreground text-background transition-opacity hover:opacity-80",
						"disabled:cursor-not-allowed disabled:opacity-50",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
					aria-label={t("send")}
				>
					<ArrowUp className="h-4 w-4" />
				</button>
			)}
		</div>
	);

	// 紧凑布局：输入框和按钮在同一行
	if (isCompactLayout) {
		return (
			<div
				className={cn(
					"relative flex flex-col rounded-md border border-border",
					"bg-background px-3 py-2 transition-colors duration-150",
					"focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20",
				)}
			>
				{/* 关联待办区域 */}
				{linkedTodos}

				{/* 关联笔记区域 */}
				<LinkedNotes locale={locale} />

				{/* @ 提及浮层（绝对定位在容器上方） */}
				{mentionPopover}

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
							"flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40",
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
