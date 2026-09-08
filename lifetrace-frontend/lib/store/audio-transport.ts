/**
 * 语音转写通道探测（纯函数，便于 node:test 直测）。
 *
 * - GET /api/cloud-audio/probe 命中 → cloud 部署（响应含 transport 与
 *   asr_configured 标志，不泄露 ASR Key）；
 * - 404 → 本地部署未挂载该路由 → local WebSocket 通道；
 * - 其他非 2xx / 网络异常 → 抛错，由调用方明确提示，不猜测回退。
 */

export type AudioTransport = "cloud" | "local";

export interface AudioTransportProbe {
	transport: AudioTransport;
	asrConfigured: boolean;
}

export async function probeAudioTransport(
	fetchImpl: typeof fetch,
	base: string,
): Promise<AudioTransportProbe> {
	const response = await fetchImpl(`${base}/api/cloud-audio/probe`);
	if (response.status === 404) {
		return { transport: "local", asrConfigured: false };
	}
	if (!response.ok) {
		throw new Error(`音频服务探测失败（HTTP ${response.status}）`);
	}
	const data = (await response.json()) as {
		transport?: string;
		asr_configured?: boolean;
	};
	if (data.transport !== "cloud") {
		return { transport: "local", asrConfigured: false };
	}
	return { transport: "cloud", asrConfigured: data.asr_configured === true };
}
