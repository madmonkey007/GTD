"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useTestAsrConfigApiTestAsrConfigPost } from "@/lib/generated/config/config";
import { useSaveConfig } from "@/lib/query";
import { toastError, toastSuccess } from "@/lib/toast";
import { SettingsSection } from "./SettingsSection";

interface AudioAsrConfigSectionProps {
	config: Record<string, unknown> | undefined;
	loading?: boolean;
}

export function AudioAsrConfigSection({ config, loading = false }: AudioAsrConfigSectionProps) {
	const t = useTranslations("page.settings");
	const saveConfigMutation = useSaveConfig();
	const testAsrMutation = useTestAsrConfigApiTestAsrConfigPost();

	const [apiKey, setApiKey] = useState((config?.audioAsrApiKey as string) || "");
	const [baseUrl, setBaseUrl] = useState(
		(config?.audioAsrBaseUrl as string) || "wss://dashscope.aliyuncs.com/api-ws/v1/inference/"
	);
	const [model, setModel] = useState((config?.audioAsrModel as string) || "fun-asr-realtime");
	const [sampleRate, setSampleRate] = useState((config?.audioAsrSampleRate as number) ?? 16000);
	const [format, setFormat] = useState((config?.audioAsrFormat as string) || "pcm");
	const [semanticPunc, setSemanticPunc] = useState(
		(config?.audioAsrSemanticPunctuationEnabled as boolean) ?? false
	);
	const [maxSilence, setMaxSilence] = useState((config?.audioAsrMaxSentenceSilence as number) ?? 1300);
	const [heartbeat, setHeartbeat] = useState((config?.audioAsrHeartbeat as boolean) ?? false);
	const [testMessage, setTestMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const isLoading = loading || saveConfigMutation.isPending || testAsrMutation.isPending;

	useEffect(() => {
		if (!config) return;
		if (config.audioAsrApiKey !== undefined) setApiKey((config.audioAsrApiKey as string) || "");
		if (config.audioAsrBaseUrl !== undefined)
			setBaseUrl((config.audioAsrBaseUrl as string) || "wss://dashscope.aliyuncs.com/api-ws/v1/inference/");
		if (config.audioAsrModel !== undefined) setModel((config.audioAsrModel as string) || "fun-asr-realtime");
		if (config.audioAsrSampleRate !== undefined)
			setSampleRate((config.audioAsrSampleRate as number) ?? 16000);
		if (config.audioAsrFormat !== undefined) setFormat((config.audioAsrFormat as string) || "pcm");
		if (config.audioAsrSemanticPunctuationEnabled !== undefined)
			setSemanticPunc((config.audioAsrSemanticPunctuationEnabled as boolean) ?? false);
		if (config.audioAsrMaxSentenceSilence !== undefined)
			setMaxSilence((config.audioAsrMaxSentenceSilence as number) ?? 1300);
		if (config.audioAsrHeartbeat !== undefined) setHeartbeat((config.audioAsrHeartbeat as boolean) ?? false);
	}, [config]);

	const handleSave = async () => {
		try {
			await saveConfigMutation.mutateAsync({
				data: {
					audioAsrApiKey: apiKey.trim(),
					audioAsrBaseUrl: baseUrl.trim(),
					audioAsrModel: model.trim(),
					audioAsrSampleRate: Number(sampleRate) || 16000,
					audioAsrFormat: format.trim() || "pcm",
					audioAsrSemanticPunctuationEnabled: semanticPunc,
					audioAsrMaxSentenceSilence: Number(maxSilence) || 1300,
					audioAsrHeartbeat: heartbeat,
				},
			});
			toastSuccess(t("saveSuccess"));
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("saveFailed", { error: msg }));
		}
	};

	const handleTestAsr = async () => {
		const currentApiKey = apiKey.trim();
		const currentBaseUrl = baseUrl.trim();
		const currentModel = model.trim();

		if (!currentApiKey || !currentBaseUrl) {
			setTestMessage({
				type: "error",
				text: t("apiKeyRequired") || "API Key 和 Base URL 不能为空",
			});
			return;
		}

		setTestMessage(null);
		try {
			const response = await testAsrMutation.mutateAsync({
				data: {
					audioAsrApiKey: currentApiKey,
					audioAsrBaseUrl: currentBaseUrl,
					audioAsrModel: currentModel,
					audioAsrSampleRate: Number(sampleRate) || 16000,
					audioAsrFormat: format.trim() || "pcm",
					audioAsrSemanticPunctuationEnabled: semanticPunc,
					audioAsrMaxSentenceSilence: Number(maxSilence) || 1300,
					audioAsrHeartbeat: heartbeat,
				},
			});

			const result = response as { success?: boolean; error?: string };
			if (result.success) {
				setTestMessage({
					type: "success",
					text: t("testSuccess") || "配置验证成功",
				});
			} else {
				setTestMessage({
					type: "error",
					text: `${t("testFailed") || "测试失败"}: ${result.error || "Unknown error"}`,
				});
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Network error";
			setTestMessage({
				type: "error",
				text: `${t("testFailed") || "测试失败"}: ${errorMsg}`,
			});
		}
	};

	return (
		<SettingsSection title={t("audioAsrConfig")}>
			<div className="space-y-4">
				{testMessage && (
					<div
						className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
							testMessage.type === "success"
								? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
								: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
						}`}
					>
						<span
							className={`inline-block h-1.5 w-1.5 rounded-full ${
								testMessage.type === "success"
									? "bg-emerald-500"
									: "bg-red-500"
							}`}
						/>
						{testMessage.text}
					</div>
				)}

				{/* API Key */}
				<div className="space-y-1.5">
					<label htmlFor="asr-api-key" className="block text-[13px] font-medium text-foreground/80">
						API Key <span className="text-destructive">*</span>
					</label>
					<input
						id="asr-api-key"
						type="password"
						className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
						placeholder="sk-..."
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						onBlur={handleSave}
						disabled={isLoading}
					/>
					<p className="text-xs text-muted-foreground/60">
						{t("apiKeyHint")}{" "}
						<a
							href="https://bailian.console.aliyun.com/?tab=api#/api"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary/80 underline-offset-2 hover:underline"
						>
							{t("apiKeyLink")}
						</a>
					</p>
				</div>

				{/* Base URL */}
				<div className="space-y-1.5">
					<label htmlFor="asr-base-url" className="block text-[13px] font-medium text-foreground/80">
						Base URL <span className="text-destructive">*</span>
					</label>
					<input
						id="asr-base-url"
						type="text"
						className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
						placeholder="wss://dashscope.aliyuncs.com/api-ws/v1/inference/"
						value={baseUrl}
						onChange={(e) => setBaseUrl(e.target.value)}
						onBlur={handleSave}
						disabled={isLoading}
					/>
				</div>

				{/* Model & Technical Params */}
				<div className="rounded-xl border border-border/40 bg-muted/20 p-3 sm:p-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
						<div className="space-y-1.5">
							<label htmlFor="asr-model" className="block text-[13px] font-medium text-foreground/80">
								模型
							</label>
							<input
								id="asr-model"
								type="text"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="fun-asr-realtime"
								value={model}
								onChange={(e) => setModel(e.target.value)}
								onBlur={handleSave}
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="asr-sample-rate" className="block text-[13px] font-medium text-foreground/80">
								采样率
							</label>
							<input
								id="asr-sample-rate"
								type="number"
								min={8000}
								step={1000}
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								value={sampleRate}
								onChange={(e) => setSampleRate(parseInt(e.target.value, 10) || 16000)}
								onBlur={handleSave}
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="asr-format" className="block text-[13px] font-medium text-foreground/80">
								格式
							</label>
							<input
								id="asr-format"
								type="text"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="pcm"
								value={format}
								onChange={(e) => setFormat(e.target.value)}
								onBlur={handleSave}
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="asr-max-silence" className="block text-[13px] font-medium text-foreground/80">
								静音阈值(ms)
							</label>
							<input
								id="asr-max-silence"
								type="number"
								min={200}
								step={100}
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								value={maxSilence}
								onChange={(e) => setMaxSilence(parseInt(e.target.value, 10) || 1300)}
								onBlur={handleSave}
								disabled={isLoading}
							/>
						</div>
					</div>
				</div>

				{/* Toggles */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
					<label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-1 text-[13px] text-foreground/80 transition-colors hover:bg-muted/30">
						<input
							type="checkbox"
							id="semantic-punc"
							checked={semanticPunc}
							onChange={(e) => {
								setSemanticPunc(e.target.checked);
								saveConfigMutation.mutate({
									data: { audioAsrSemanticPunctuationEnabled: e.target.checked },
								});
							}}
							disabled={isLoading}
							className="h-4 w-4 shrink-0 rounded border-border/60 text-primary focus:ring-primary/20"
						/>
						语义断句
					</label>
					<label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-1 text-[13px] text-foreground/80 transition-colors hover:bg-muted/30">
						<input
							type="checkbox"
							id="asr-heartbeat"
							checked={heartbeat}
							onChange={(e) => {
								setHeartbeat(e.target.checked);
								saveConfigMutation.mutate({
									data: { audioAsrHeartbeat: e.target.checked },
								});
							}}
							disabled={isLoading}
							className="h-4 w-4 shrink-0 rounded border-border/60 text-primary focus:ring-primary/20"
						/>
						WebSocket 心跳
					</label>
				</div>

				{/* Test button */}
				<button
					type="button"
					onClick={async () => {
						if (document.activeElement instanceof HTMLElement) {
							document.activeElement.blur();
						}
						await new Promise((resolve) => setTimeout(resolve, 50));
						await handleTestAsr();
					}}
					disabled={isLoading || !apiKey.trim() || !baseUrl.trim()}
					className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
				>
					{testAsrMutation.isPending
						? `${t("testConnection") || "测试连接"}...`
						: t("testConnection") || "测试连接"}
				</button>
			</div>
		</SettingsSection>
	);
}
