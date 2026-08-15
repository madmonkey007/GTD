/**
 * 全局音频录音状态管理
 *
 * 将录音状态和资源提升到全局层面，使录音在面板切换时不会中断。
 * 核心思路：
 * - 使用模块级变量存储不可序列化的资源（WebSocket、AudioContext、MediaStream）
 * - 使用 Zustand store 存储可序列化的状态（isRecording、transcriptionText 等）
 * - 组件卸载时不清理录音资源，只有显式调用 stopRecording 才会停止
 */

import { create } from "zustand";
import { authHeaders } from "@/lib/auth/session";

// ========== 类型定义 ==========

interface TodoItem {
	title: string;
	description?: string;
	deadline?: string;
	source_text?: string;
}

interface ScheduleItem {
	title: string;
	time?: string;
	description?: string;
	source_text?: string;
}

type TranscriptionCallback = (text: string, isFinal: boolean) => void

type RealtimeNlpCallback = (data: {
		optimizedText?: string;
		todos?: TodoItem[];
		schedules?: ScheduleItem[];
	}) => void

type ErrorCallback = (error: Error) => void

interface AudioRecordingState {
	/** 是否正在录音 */
	isRecording: boolean;
	/** 录音开始时间（毫秒时间戳） */
	recordingStartedAt: number | null;
	/** 录音开始的 Date 对象（用于时间标签） */
	recordingStartedDate: Date | null;
	/** 上一个 final 文本的时间戳（用于计算段落时间） */
	lastFinalEndMs: number | null;

	// ===== 转录数据（在面板切换时保持） =====
	/** 原始转录文本 */
	transcriptionText: string;
	/** 正在识别的部分文本（未确认） */
	partialText: string;
	/** 优化后的文本 */
	optimizedText: string;
	/** 段落时间（秒） */
	segmentTimesSec: number[];
	/** 段落时间标签 */
	segmentTimeLabels: string[];
	/** 段落录音 ID */
	segmentRecordingIds: number[];
	/** 段落偏移（秒） */
	segmentOffsetsSec: number[];
	/** 实时提取的待办 */
	liveTodos: TodoItem[];
	/** 实时提取的日程 */
	liveSchedules: ScheduleItem[];
}

interface AudioRecordingActions {
	/** 开始录音 */
	startRecording: (
		onTranscription: TranscriptionCallback,
		onRealtimeNlp?: RealtimeNlpCallback,
		onError?: ErrorCallback,
		is24x7?: boolean,
	) => Promise<void>;
	/** 停止录音（等待最终识别结果后再关闭 WS） */
	stopRecording: (segmentTimestamps?: number[]) => Promise<void>;
	/** 重置时间戳引用（用于新段落） */
	resetLastFinalEnd: () => void;
	/** 更新 lastFinalEndMs */
	updateLastFinalEnd: (ms: number) => void;

	// ===== 转录数据更新方法 =====
	/** 追加转录文本 */
	appendTranscriptionText: (text: string) => void;
	/** 设置部分文本 */
	setPartialText: (text: string) => void;
	/** 设置优化文本 */
	setOptimizedText: (text: string) => void;
	/** 追加段落数据 */
	appendSegmentData: (data: {
		timeSec: number;
		timeLabel: string;
		recordingId: number;
		offsetSec: number;
	}) => void;
	/** 设置实时待办 */
	setLiveTodos: (todos: TodoItem[]) => void;
	/** 设置实时日程 */
	setLiveSchedules: (schedules: ScheduleItem[]) => void;
	/** 清空录音会话数据（开始新录音时调用） */
	clearSessionData: () => void;
}

type AudioRecordingStore = AudioRecordingState & AudioRecordingActions;

// ========== 模块级资源存储（不可序列化） ==========

let mediaRecorderRef: MediaRecorder | null = null;
let mediaStreamRef: MediaStream | null = null;
let recordingChunksRef: Blob[] = [];

// 回调函数引用（用于在 WebSocket 消息中调用）
let currentOnTranscription: TranscriptionCallback | null = null;
let currentOnError: ErrorCallback | null = null;

// ========== 内部辅助函数 ==========

/**
 * 获取 API 基础 URL
 */
function getApiBaseUrl(): string {
	return (
		process.env.NEXT_PUBLIC_API_URL ||
		(typeof window !== "undefined" &&
			(window as Window & { __BACKEND_URL__?: string }).__BACKEND_URL__) ||
		"http://localhost:8001"
	);
}

/**
 * 清理录音资源
 * @param segmentTimestamps 段落时间戳数组
 * @param isReconnecting 是否正在重连（重连时不清理回调）
 * @param sendStop 是否发送 stop 消息（停止流程已先行发送过时传 false）
 */
function cleanupRecordingResources(clearCallbacks = true): void {
	if (mediaRecorderRef && mediaRecorderRef.state !== "inactive") {
		try {
			mediaRecorderRef.stop();
		} catch {
			// ignore
		}
	}
	mediaRecorderRef = null;
	if (mediaStreamRef) {
		for (const track of mediaStreamRef.getTracks()) {
			track.stop();
		}
		mediaStreamRef = null;
	}
	if (clearCallbacks) {
		currentOnTranscription = null;
		currentOnError = null;
	}
}

function getPreferredAudioMimeType(): string | undefined {
	const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
	return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function fileExtensionFromMimeType(type: string): string {
	if (type.includes("mp4")) return "m4a";
	if (type.includes("mpeg")) return "mp3";
	if (type.includes("wav")) return "wav";
	return "webm";
}

function waitForRecorderStop(recorder: MediaRecorder): Promise<Blob> {
	return new Promise((resolve, reject) => {
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) recordingChunksRef.push(event.data);
		};
		recorder.onerror = () => reject(new Error("录音失败，请重试"));
		recorder.onstop = () => {
			const type = recorder.mimeType || "audio/webm";
			resolve(new Blob(recordingChunksRef, { type }));
		};
	});
}

async function fetchJson<T>(path: string, init: RequestInit): Promise<T> {
	const response = await fetch(`${getApiBaseUrl()}${path}`, init);
	if (!response.ok) throw new Error(`音频云端服务返回 ${response.status}`);
	return response.json() as Promise<T>;
}

async function transcribeCloudRecording(blob: Blob): Promise<string> {
	if (blob.size === 0) throw new Error("没有录到可上传的音频");
	const extension = fileExtensionFromMimeType(blob.type);
	const upload = await fetchJson<{ task_id: string; upload_url: string }>("/api/cloud-audio/uploads", {
		method: "POST",
		headers: authHeaders({ "Content-Type": "application/json" }),
		body: JSON.stringify({ filename: `recording.${extension}`, content_type: blob.type || "audio/webm" }),
	});

	const uploadResponse = await fetch(upload.upload_url, {
		method: "PUT",
		headers: { "Content-Type": blob.type || "audio/webm" },
		body: blob,
	});
	if (!uploadResponse.ok) throw new Error(`音频上传失败：${uploadResponse.status}`);

	await fetchJson<{ status: string }>("/api/cloud-audio/transcriptions", {
		method: "POST",
		headers: authHeaders({ "Content-Type": "application/json" }),
		body: JSON.stringify({ task_id: upload.task_id }),
	});

	for (let attempt = 0; attempt < 90; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		const result = await fetchJson<{ status: string; text?: string; error?: string }>(
			`/api/cloud-audio/transcriptions/${upload.task_id}`,
			{ method: "GET", headers: authHeaders() },
		);
		if (result.status === "completed") return result.text || "";
		if (result.status === "failed") throw new Error(result.error || "转写失败");
	}
	throw new Error("转写仍在处理中，请稍后重试");
}

// ========== Zustand Store ==========

export const useAudioRecordingStore = create<AudioRecordingStore>((set, get) => ({
	// ===== 核心状态 =====
	isRecording: false,
	recordingStartedAt: null,
	recordingStartedDate: null,
	lastFinalEndMs: null,

	// ===== 转录数据 =====
	transcriptionText: "",
	partialText: "",
	optimizedText: "",
	segmentTimesSec: [],
	segmentTimeLabels: [],
	segmentRecordingIds: [],
	segmentOffsetsSec: [],
	liveTodos: [],
	liveSchedules: [],

	// ===== Actions =====

	startRecording: async (onTranscription, _onRealtimeNlp, onError, _is24x7 = false) => {
		// 如果已经在录音，直接返回
		if (get().isRecording) {
			console.warn("[AudioRecordingStore] Already recording, ignoring start request");
			return;
		}

		try {
			// 获取麦克风权限
			console.log("[AudioRecordingStore] 请求麦克风权限...");
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			console.log("[AudioRecordingStore] ✅ 麦克风权限已获取");
			mediaStreamRef = stream;
			recordingChunksRef = [];

			// 保存回调引用
			currentOnTranscription = onTranscription;
			currentOnError = onError || null;
			const options = getPreferredAudioMimeType();
			const recorder = options ? new MediaRecorder(stream, { mimeType: options }) : new MediaRecorder(stream);
			mediaRecorderRef = recorder;
			recorder.start();

			const now = Date.now();
			set({
				isRecording: true,
				recordingStartedAt: now,
				recordingStartedDate: new Date(),
				lastFinalEndMs: null,
			});
		} catch (error) {
			console.error("Failed to start recording:", error);
			cleanupRecordingResources();
			if (onError) {
				onError(error as Error);
			}
		}
	},

	/** 停止录音 */
	stopRecording: async () => {
		const recorder = mediaRecorderRef;
		if (!recorder) return;

		const stopped = waitForRecorderStop(recorder);
		recorder.stop();
		mediaRecorderRef = null;
		if (mediaStreamRef) {
			for (const track of mediaStreamRef.getTracks()) track.stop();
			mediaStreamRef = null;
		}
		set({
			isRecording: false,
			recordingStartedAt: null,
			recordingStartedDate: null,
			lastFinalEndMs: null,
		});

		try {
			const blob = await stopped;
			const text = await transcribeCloudRecording(blob);
			if (text && currentOnTranscription) currentOnTranscription(text, true);
		} catch (error) {
			console.error("Failed to transcribe recording:", error);
			if (currentOnError) currentOnError(error as Error);
		} finally {
			recordingChunksRef = [];
			currentOnTranscription = null;
			currentOnError = null;
		}
	},

	resetLastFinalEnd: () => {
		set({ lastFinalEndMs: null });
	},

	updateLastFinalEnd: (ms) => {
		set({ lastFinalEndMs: ms });
	},

	// ===== 转录数据更新方法 =====

	appendTranscriptionText: (text) => {
		set((state) => {
			const prev = state.transcriptionText;
			const needsGap = prev && !prev.endsWith("\n");
			return {
				transcriptionText: `${prev}${needsGap ? "\n" : ""}${text}\n`,
			};
		});
	},

	setPartialText: (text) => {
		set({ partialText: text });
	},

	setOptimizedText: (text) => {
		set({ optimizedText: text });
	},

	appendSegmentData: (data) => {
		set((state) => ({
			segmentTimesSec: [...state.segmentTimesSec, data.timeSec],
			segmentTimeLabels: [...state.segmentTimeLabels, data.timeLabel],
			segmentRecordingIds: [...state.segmentRecordingIds, data.recordingId],
			segmentOffsetsSec: [...state.segmentOffsetsSec, data.offsetSec],
		}));
	},

	setLiveTodos: (todos) => {
		set({ liveTodos: todos });
	},

	setLiveSchedules: (schedules) => {
		set({ liveSchedules: schedules });
	},

	clearSessionData: () => {
		set({
			transcriptionText: "",
			partialText: "",
			optimizedText: "",
			segmentTimesSec: [],
			segmentTimeLabels: [],
			segmentRecordingIds: [],
			segmentOffsetsSec: [],
			liveTodos: [],
			liveSchedules: [],
		});
	},
}));

// ========== 辅助 Hooks ==========

/**
 * 获取录音开始后的经过时间（毫秒）
 */
export function getRecordingElapsedMs(): number {
	const { recordingStartedAt } = useAudioRecordingStore.getState();
	if (!recordingStartedAt) return 0;
	return Date.now() - recordingStartedAt;
}

/**
 * 获取段落的开始时间（相对于录音开始）
 * 优先使用 lastFinalEndMs，否则使用录音开始时间
 */
export function getSegmentStartMs(): number {
	const { recordingStartedAt, lastFinalEndMs } = useAudioRecordingStore.getState();
	if (!recordingStartedAt) return 0;
	return lastFinalEndMs ?? recordingStartedAt;
}
