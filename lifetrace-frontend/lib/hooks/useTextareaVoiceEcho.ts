"use client";

import { useEffect, useRef } from "react";
import { useAudioRecordingStore } from "@/lib/store/audio-recording-store";

interface TextareaVoiceEchoHandlers {
	onTranscript: (text: string) => void;
	onPartial?: (text: string) => void;
	onSegmentFinal?: (text: string) => void;
}

/**
 * textarea 语音实时回显：录音时把「起始内容 + 已固化句 + 当前 partial」实时写回输入框
 * （边说边出字），结束后以最终文本做一次权威替换。模仿 DiaryTiptapEditor 的同款交互。
 */
export function useTextareaVoiceEcho(
	getValue: () => string,
	apply: (value: string) => void,
): TextareaVoiceEchoHandlers {
	const startRef = useRef<string | null>(null);
	const baseRef = useRef("");
	const doneRef = useRef(false);
	const isRecording = useAudioRecordingStore((s) => s.isRecording);

	// 录音开始时重置回显状态；结束后清掉起始值快照
	useEffect(() => {
		if (isRecording) {
			startRef.current = null;
			baseRef.current = "";
			doneRef.current = false;
		} else {
			startRef.current = null;
		}
	}, [isRecording]);

	const compose = (...parts: string[]) =>
		parts.map((p) => p.trim()).filter(Boolean).join(" ");

	const ensureStart = () => {
		if (startRef.current === null) startRef.current = getValue();
		return startRef.current;
	};

	return {
		onTranscript: (text) => {
			if (doneRef.current || !text.trim()) return;
			doneRef.current = true;
			apply(compose(ensureStart(), text));
		},
		onPartial: (text) => {
			if (doneRef.current) return;
			apply(compose(ensureStart(), baseRef.current, text));
		},
		onSegmentFinal: (text) => {
			if (doneRef.current) return;
			baseRef.current = compose(baseRef.current, text);
			apply(compose(ensureStart(), baseRef.current));
		},
	};
}
