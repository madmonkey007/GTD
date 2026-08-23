"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { useConfig } from "@/lib/query";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";

interface VoiceInputButtonProps {
	onTranscript: (text: string) => void;
	onPartial?: (text: string) => void;
	className?: string;
	title?: string;
	/** Tiptap 工具栏内点击时阻止冒泡 */
	stopPropagation?: boolean;
	/** 可选：录音前 focus（解决 Tiptap 失焦插入问题），传 ref 对象以便读取实时 editor */
	editorRef?: { current: { commands: { focus: () => unknown } } | null } | null;
	/** 输入框唯一标识：面板切换后用于恢复本输入框的录音态 */
	ownerId?: string;
	/** 卸载时停止录音（弹窗类输入框传 true） */
	stopOnUnmount?: boolean;
}

export function VoiceInputButton({
	onTranscript,
	onPartial,
	className = "flex h-8 w-8 items-center justify-center rounded-lg",
	title,
	stopPropagation,
	editorRef,
	ownerId,
	stopOnUnmount,
}: VoiceInputButtonProps) {
	const voice = useVoiceInput({
		onTranscript,
		onPartial,
		ownerId,
		stopOnUnmount,
	});

	const [elapsedTime, setElapsedTime] = useState(0);

	// 云端语音输入尚不完善：云端 /api/get-config 不下发 ASR key（返回空配置），
	// 配置未就绪时直接隐藏麦克风按钮；本地配置了 ASR 则照常显示
	const { data: appConfig } = useConfig();
	const asrKey = String(
		(appConfig as Record<string, unknown> | undefined)?.audio_asr_api_key ??
			(appConfig as Record<string, unknown> | undefined)?.audioAsrApiKey ??
			"",
	).trim();
	const asrConfigured = asrKey.length > 0 && !/YOUR_(LLM|ASR|API)_KEY_HERE|XXX/.test(asrKey.toUpperCase());

	useEffect(() => {
		const start = voice.recordingStartedAt;
		if (!voice.isRecording || !start) {
			setElapsedTime(0);
			return;
		}
		const update = () => {
			setElapsedTime(
				Math.max(0, Math.floor((Date.now() - start) / 1000)),
			);
		};
		update();
		const interval = setInterval(update, 1000);
		return () => clearInterval(interval);
	}, [voice.isRecording, voice.recordingStartedAt]);

	// 云端语音输入尚不完善：云端 /api/get-config 不下发 ASR key（返回空配置），
	// 配置未就绪时直接隐藏麦克风按钮；本地配置了 ASR 则照常显示。
	// 注意必须放在所有 hooks 之后，避免条件渲染破坏 hooks 规则。
	if (appConfig !== undefined && !asrConfigured) {
		return null;
	}

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const handleClick = () => {
		if (editorRef?.current && !voice.isRecording) {
			editorRef.current.commands.focus();
		}
		voice.toggle();
	};

	const handleMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
		// 阻止失焦（textareas/contentEditable/Tiptap 编辑器），避免触发 blur 自动保存
		e.preventDefault();
		if (stopPropagation) {
			e.stopPropagation();
		}
	};

	const base =
		"transition-colors hover:bg-foreground/5 text-muted-foreground";

	if (voice.isThisRecording) {
		return (
			<button
				type="button"
				onMouseDown={handleMouseDown}
				onClick={handleClick}
				title={title ?? "停止录音"}
				aria-label="停止录音"
				className={`${className} ${base} flex items-center gap-1 text-red-500 hover:bg-red-500/10`}
			>
				<span className="relative flex h-2 w-2">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
					<span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
				</span>
				<MicOff className="h-4 w-4" />
				<span className="text-xs tabular-nums">{formatTime(elapsedTime)}</span>
			</button>
		);
	}

	return (
		<button
			type="button"
			onMouseDown={handleMouseDown}
			onClick={handleClick}
			title={
				voice.isOccupied
					? title ?? "其他输入框正在录音"
					: title ?? "语音输入"
			}
			aria-label={voice.isOccupied ? "其他输入框正在录音" : "语音输入"}
			className={`${className} ${base} ${
				voice.isOccupied ? "cursor-not-allowed opacity-40" : ""
			}`}
		>
			<Mic className="h-4 w-4" />
		</button>
	);
}
