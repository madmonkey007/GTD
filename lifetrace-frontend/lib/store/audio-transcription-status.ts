/**
 * 云端录音转写状态的纯函数集合。
 *
 * 与 audio-recording-store 分离为无副作用模块，便于用 node:test 直接测试
 * （store 依赖 zustand 和 @/ 路径别名，不适合在 node:test 中加载）。
 */

/** 录音结束后的转写进度状态 */
export type TranscriptionStatus = "idle" | "uploading" | "transcribing" | "completed" | "failed";

/** 驱动转写状态流转的事件 */
export type TranscriptionEvent =
	| "recording-stopped"
	| "upload-finished"
	| "transcription-finished"
	| "transcription-failed";

/**
 * 根据事件计算下一个转写状态：
 * - 录音结束 → uploading（上传录音）
 * - 上传完成 → transcribing（轮询转写）
 * - 转写成功 → completed
 * - 上传/轮询失败 → failed
 */
export function nextTranscriptionStatus(event: TranscriptionEvent): TranscriptionStatus {
	switch (event) {
		case "recording-stopped":
			return "uploading";
		case "upload-finished":
			return "transcribing";
		case "transcription-finished":
			return "completed";
		case "transcription-failed":
			return "failed";
	}
}

/** 是否正处于上传/转写阶段（期间禁止重复开始或停止录音） */
export function isTranscriptionBusy(status: TranscriptionStatus): boolean {
	return status === "uploading" || status === "transcribing";
}

/** 转写状态的中文提示文案 */
export function transcriptionStatusLabel(status: TranscriptionStatus): string {
	switch (status) {
		case "uploading":
			return "正在上传录音…";
		case "transcribing":
			return "正在转写录音…";
		default:
			return "";
	}
}
