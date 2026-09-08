import assert from "node:assert/strict";
import test from "node:test";

import { probeAudioTransport } from "./audio-transport.ts";

function jsonResponse(status: number, body?: unknown): typeof fetch {
	return (async () => ({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body ?? {},
	})) as unknown as typeof fetch;
}

test("404 selects the local WebSocket transport", async () => {
	const probe = await probeAudioTransport(jsonResponse(404), "");
	assert.equal(probe.transport, "local");
	assert.equal(probe.asrConfigured, false);
});

test("200 + transport=cloud selects the cloud HTTP transport", async () => {
	const probe = await probeAudioTransport(
		jsonResponse(200, { transport: "cloud", asr_configured: true }),
		"",
	);
	assert.equal(probe.transport, "cloud");
	assert.equal(probe.asrConfigured, true);
});

test("200 without cloud transport field falls back to local", async () => {
	const probe = await probeAudioTransport(jsonResponse(200, {}), "");
	assert.equal(probe.transport, "local");
	assert.equal(probe.asrConfigured, false);
});

test("200 + cloud + asr_configured=false keeps cloud transport but reports unconfigured", async () => {
	const probe = await probeAudioTransport(
		jsonResponse(200, { transport: "cloud", asr_configured: false }),
		"",
	);
	assert.equal(probe.transport, "cloud");
	assert.equal(probe.asrConfigured, false);
});

test("non-404 error status throws an explicit probe failure", async () => {
	await assert.rejects(
		probeAudioTransport(jsonResponse(500), ""),
		/音频服务探测失败/,
	);
});

test("network failure propagates instead of silently falling back", async () => {
	await assert.rejects(
		probeAudioTransport(
			(async () => {
				throw new Error("network down");
			}) as unknown as typeof fetch,
			"",
		),
		/network down/,
	);
});
