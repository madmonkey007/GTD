"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConfig } from "@/lib/query";
import { useAudioRecordingStore } from "@/lib/store/audio-recording-store";
import { toastError, toastWarning } from "@/lib/toast";

export interface UseVoiceInputOptions {
	/** 录音结束，把 final 文本追加到输入框 */
	onTranscript: (text: string) => void;
	/** 可选：实时 partial 预览 */
	onPartial?: (text: string) => void;
	/** 默认 true：启动前用 useConfig 探测 ASR key 是否已配置 */
	checkConfig?: boolean;
	/** 输入框唯一标识：跨面板切换后恢复该输入框的录音态 */
	ownerId?: string;
	/** 卸载时是否停止录音（弹窗类输入框传 true，常驻面板不传以跨面板保持录音） */
	stopOnUnmount?: boolean;
}

export interface UseVoiceInputResult {
	/** = 全局 store.isRecording */
	isRecording: boolean;
	/** 本次录音是否由本按钮发起 */
	isThisRecording: boolean;
	/** isRecording && !isThisRecording → 别的输入框在录 */
	isOccupied: boolean;
	recordingStartedAt: number | null;
	error: Error | null;
	supported: boolean;
	/** 空闲→开始；本按钮录音中→停止并回填；被占用→toastWarning */
	toggle: () => void;
	stop: () => void;
	/** 停止但不回填（卸载清理） */
	abort: () => void;
	clearError: () => void;
}

const PLACEHOLDER_PATTERNS = [
	"YOUR_LLM_KEY_HERE",
	"YOUR_API_KEY_HERE",
	"YOUR_ASR_KEY_HERE",
	"XXX",
];

function isPlaceholderKey(key: string): boolean {
	const normalized = key.trim().toUpperCase();
	if (!normalized) return true;
	return PLACEHOLDER_PATTERNS.some((p) => normalized.includes(p));
}

const UNCONFIGURED_ERROR_PATTERNS = [
	"未配置",
	"YOUR_LLM_KEY_HERE",
	"YOUR_API_KEY_HERE",
	"YOUR_ASR_KEY_HERE",
	"401",
	"403",
	"connection refused",
	"websocket",
];

function normalizeError(error: Error): string {
	const message = error?.message ?? String(error);
	const lower = message.toLowerCase();
	if (
		lower.includes("notallowederror") ||
		lower.includes("permission denied")
	) {
		return "麦克风权限被拒绝，请在浏览器设置中允许访问麦克风";
	}
	if (
		UNCONFIGURED_ERROR_PATTERNS.some((p) =>
			lower.includes(p.toLowerCase()),
		)
	) {
		return "语音转写未配置或不可用，请联系管理员设置 ASR key";
	}
	return `语音转写失败：${message}`;
}

// 当前录音由哪个输入框发起（ownerId）。用于面板切换后恢复发起者的录音态。
let activeVoiceOwnerId: string | null = null;

// 当前录音收集的 final 文本。模块级而非实例 useRef：录音跨面板存活时，
// 发起方实例已卸载，切回后的新实例 stop() 必须能读到此前收集的文本。
let voiceFinalBuffer = "";

// 最新 partial 文本（DashScope 的 partial 是累计全文）。
// 后端的最终结果(is_final)经 WS 关闭时容易丢帧、且 stop 信号偶发不达后端，
// 因此以"最新 partial"作为回填的可靠主来源。
let voicePartialBuffer = "";

const DEFAULT_OWNER_ID = "__voice_default__";

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputResult {
	const { data: config } = useConfig();

	// options 可能每次渲染变化，存 ref 保证内部回调稳定
	const optionsRef = useRef(options);
	optionsRef.current = options;

	// 输入框稳定身份：面板卸载再挂载后仍能识别“这个输入框发起了录音”
	const ownerIdRef = useRef(options.ownerId ?? DEFAULT_OWNER_ID);
	ownerIdRef.current = options.ownerId ?? DEFAULT_OWNER_ID;

	// config 异步加载，存 ref 供 toggle 在事件时读取最新值
	// 后端 /api/get-config 返回扁平 snake_case：audio_asr_api_key
	const configRef = useRef<string | undefined>(undefined);
	useEffect(() => {
		const cfg = config as Record<string, unknown> | undefined;
		configRef.current = (cfg?.audio_asr_api_key ?? cfg?.audioAsrApiKey) as
			| string
			| undefined;
	}, [config]);

	const [supported, setSupported] = useState(false);
	useEffect(() => {
		setSupported(
			typeof navigator !== "undefined" &&
				!!navigator.mediaDevices?.getUserMedia &&
				typeof WebSocket !== "undefined",
		);
	}, []);

	const isRecording = useAudioRecordingStore((state) => state.isRecording);
	const recordingStartedAt = useAudioRecordingStore(
		(state) => state.recordingStartedAt,
	);
	const startRecording = useAudioRecordingStore((state) => state.startRecording);
	const stopRecording = useAudioRecordingStore((state) => state.stopRecording);
	const clearSessionData = useAudioRecordingStore((state) => state.clearSessionData);

	const [isThisRecording, setIsThisRecording] = useState(false);
	const isThisRecordingRef = useRef(false);
	const [error, setError] = useState<Error | null>(null);

	// 只收集 final 文本，用空格拼接；过滤分段保存标记
	// 使用模块级 voiceFinalBuffer 而非实例 useRef（见上方声明）

	// 面板切换回来时：若录音仍由本输入框发起，恢复录音态（可停止并回填）
	useEffect(() => {
		if (
			activeVoiceOwnerId !== null &&
			activeVoiceOwnerId === ownerIdRef.current &&
			useAudioRecordingStore.getState().isRecording
		) {
			isThisRecordingRef.current = true;
			setIsThisRecording(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleTranscription = useCallback(
		(text: string, isFinal: boolean) => {
			if (isFinal && text.startsWith("__SEGMENT_SAVED__")) return;
			if (isFinal) {
				const trimmed = text.trim();
				if (trimmed) {
					voiceFinalBuffer = voiceFinalBuffer
						? `${voiceFinalBuffer} ${trimmed}`
						: trimmed;
				}
			} else {
				// partial 是累计全文，记录最新值作为回填主来源
				voicePartialBuffer = text;
				optionsRef.current.onPartial?.(text);
			}
		},
		[],
	);

	const handleError = useCallback((err: Error) => {
		setError(err);
		toastError(normalizeError(err));
		if (isThisRecordingRef.current) {
			isThisRecordingRef.current = false;
			setIsThisRecording(false);
			activeVoiceOwnerId = null;
		}
		voiceFinalBuffer = "";
		voicePartialBuffer = "";
	}, []);

	const stop = useCallback(() => {
		if (!isThisRecordingRef.current) return;
		isThisRecordingRef.current = false;
		setIsThisRecording(false);
		activeVoiceOwnerId = null;
		// 立即（同步）用当前已到达的文本回填输入框。
		// partial 是累计全文，录音过程中已稳稳到达；停止瞬间即可用，无需等 WS final。
		// 优先 final，回退最新 partial。
		const text = (voiceFinalBuffer.trim() || voicePartialBuffer.trim());
		voiceFinalBuffer = "";
		voicePartialBuffer = "";
		if (text) {
			optionsRef.current.onTranscript(text);
		}
		// 异步关闭录音 WS（不阻塞回填）；intentionalCloseRef 会屏蔽关闭时的 onerror
		void stopRecording();
	}, [stopRecording]);

	const toggle = useCallback(() => {
		if (!supported) {
			toastError("当前浏览器不支持语音输入");
			return;
		}
		if (optionsRef.current.checkConfig !== false) {
			const key = configRef.current;
			if (typeof key === "string" && isPlaceholderKey(key)) {
				toastError("语音转写未配置或不可用，请联系管理员设置 ASR key");
				return;
			}
		}
		if (isThisRecordingRef.current) {
			stop();
			return;
		}
		if (useAudioRecordingStore.getState().isRecording) {
			toastWarning("正在其他输入框录音中");
			return;
		}
		clearSessionData();
		voiceFinalBuffer = "";
		voicePartialBuffer = "";
		isThisRecordingRef.current = true;
		setIsThisRecording(true);
		activeVoiceOwnerId = ownerIdRef.current;
		setError(null);
		startRecording(handleTranscription, undefined, handleError, false).catch(
			handleError,
		);
	}, [supported, stop, startRecording, clearSessionData, handleTranscription, handleError]);

	const abort = useCallback(() => {
		voiceFinalBuffer = "";
		voicePartialBuffer = "";
		isThisRecordingRef.current = false;
		setIsThisRecording(false);
		activeVoiceOwnerId = null;
		stopRecording();
	}, [stopRecording]);

	const clearError = useCallback(() => setError(null), []);

	// R2：录制中的按钮被另一按钮 abort 后，同步清 isThisRecording
	useEffect(() => {
		if (!isRecording && isThisRecordingRef.current) {
			isThisRecordingRef.current = false;
			setIsThisRecording(false);
			activeVoiceOwnerId = null;
		}
	}, [isRecording]);

	// 卸载清理：仅 stopOnUnmount 的输入框（弹窗类）卸载时停止录音；
	// 常驻面板（主 Chat/智能指令等）卸载时保留全局录音，切回后恢复录音态
	useEffect(() => {
		return () => {
			if (optionsRef.current.stopOnUnmount && isThisRecordingRef.current) {
				useAudioRecordingStore.getState().stopRecording();
				activeVoiceOwnerId = null;
			}
		};
	}, []);

	return {
		isRecording,
		isThisRecording,
		isOccupied: isRecording && !isThisRecording,
		recordingStartedAt,
		error,
		supported,
		toggle,
		stop,
		abort,
		clearError,
	};
}
