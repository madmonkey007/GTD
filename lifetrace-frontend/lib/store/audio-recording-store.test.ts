import assert from "node:assert/strict";
import test from "node:test";

import {
	isTranscriptionBusy,
	nextTranscriptionStatus,
	transcriptionStatusLabel,
} from "./audio-transcription-status.ts";

test("成功状态序列：录音结束 → 上传 → 转写 → 完成", () => {
	const statuses = [
		nextTranscriptionStatus("recording-stopped"),
		nextTranscriptionStatus("upload-finished"),
		nextTranscriptionStatus("transcription-finished"),
	];

	assert.deepEqual(statuses, ["uploading", "transcribing", "completed"]);
});

test("上传阶段失败 → failed", () => {
	assert.equal(nextTranscriptionStatus("transcription-failed"), "failed");
});

test("轮询转写阶段失败 → failed", () => {
	assert.equal(nextTranscriptionStatus("transcription-failed"), "failed");
});

test("上传/转写期间 isTranscriptionBusy 为 true", () => {
	assert.equal(isTranscriptionBusy("uploading"), true);
	assert.equal(isTranscriptionBusy("transcribing"), true);
});

test("空闲/完成/失败期间 isTranscriptionBusy 为 false", () => {
	assert.equal(isTranscriptionBusy("idle"), false);
	assert.equal(isTranscriptionBusy("completed"), false);
	assert.equal(isTranscriptionBusy("failed"), false);
});

test("中文提示文案", () => {
	assert.equal(transcriptionStatusLabel("uploading"), "正在上传录音…");
	assert.equal(transcriptionStatusLabel("transcribing"), "正在转写录音…");
	assert.equal(transcriptionStatusLabel("idle"), "");
	assert.equal(transcriptionStatusLabel("completed"), "");
	assert.equal(transcriptionStatusLabel("failed"), "");
});
