"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
	useSaveAndInitLlmApiSaveAndInitLlmPost,
	useTestLlmConfigApiTestLlmConfigPost,
} from "@/lib/generated/config/config";
import { useSaveConfig } from "@/lib/query";
import { toastError } from "@/lib/toast";
import { SettingsSection } from "./SettingsSection";

interface LlmConfigSectionProps {
	config: Record<string, unknown> | undefined;
	loading?: boolean;
}

export function LlmConfigSection({
	config,
	loading = false,
}: LlmConfigSectionProps) {
	const t = useTranslations("page.settings");
	const queryClient = useQueryClient();
	const saveConfigMutation = useSaveConfig();
	const testLlmMutation = useTestLlmConfigApiTestLlmConfigPost();
	const saveAndInitLlmMutation = useSaveAndInitLlmApiSaveAndInitLlmPost();

	const [llmApiKey, setLlmApiKey] = useState(
		(config?.llmApiKey as string) || "",
	);
	const [llmBaseUrl, setLlmBaseUrl] = useState(
		(config?.llmBaseUrl as string) || "",
	);
	const [llmModel, setLlmModel] = useState(
		(config?.llmModel as string) || "qwen-plus",
	);
	const [llmTemperature, setLlmTemperature] = useState(
		(config?.llmTemperature as number) ?? 0.7,
	);
	const [llmMaxTokens, setLlmMaxTokens] = useState(
		(config?.llmMaxTokens as number) ?? 2048,
	);
	const [initialLlmConfig, setInitialLlmConfig] = useState({
		llmApiKey: (config?.llmApiKey as string) || "",
		llmBaseUrl: (config?.llmBaseUrl as string) || "",
		llmModel: (config?.llmModel as string) || "qwen-plus",
		llmTemperature: (config?.llmTemperature as number) ?? 0.7,
		llmMaxTokens: (config?.llmMaxTokens as number) ?? 2048,
	});
	const [testMessage, setTestMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const isLoading =
		loading ||
		saveConfigMutation.isPending ||
		testLlmMutation.isPending ||
		saveAndInitLlmMutation.isPending;

	useEffect(() => {
		if (config) {
			if (config.llmApiKey !== undefined) {
				setLlmApiKey((config.llmApiKey as string) || "");
			}
			if (config.llmBaseUrl !== undefined) {
				setLlmBaseUrl((config.llmBaseUrl as string) || "");
			}
			if (config.llmModel !== undefined) {
				setLlmModel((config.llmModel as string) || "qwen-plus");
			}
			if (config.llmTemperature !== undefined) {
				setLlmTemperature((config.llmTemperature as number) ?? 0.7);
			}
			if (config.llmMaxTokens !== undefined) {
				setLlmMaxTokens((config.llmMaxTokens as number) ?? 2048);
			}
			setInitialLlmConfig({
				llmApiKey: (config.llmApiKey as string) || "",
				llmBaseUrl: (config.llmBaseUrl as string) || "",
				llmModel: (config?.llmModel as string) || "qwen-plus",
				llmTemperature: (config?.llmTemperature as number) ?? 0.7,
				llmMaxTokens: (config?.llmMaxTokens as number) ?? 2048,
			});
		}
	}, [config]);

	const handleTestLlm = async () => {
		const currentApiKey = llmApiKey.trim();
		const currentBaseUrl = llmBaseUrl.trim();
		const currentModel = llmModel.trim();

		if (!currentApiKey || !currentBaseUrl) {
			setTestMessage({
				type: "error",
				text: t("apiKeyRequired"),
			});
			return;
		}

		setTestMessage(null);
		try {
			const response = await testLlmMutation.mutateAsync({
				data: {
					llmApiKey: currentApiKey,
					llmBaseUrl: currentBaseUrl,
					llmModel: currentModel,
				},
			});

			const result = response as { success?: boolean; error?: string };
			if (result.success) {
				setTestMessage({
					type: "success",
					text: t("testSuccess"),
				});
			} else {
				setTestMessage({
					type: "error",
					text: `${t("testFailed")}: ${result.error || "Unknown error"}`,
				});
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Network error";
			setTestMessage({
				type: "error",
				text: `${t("testFailed")}: ${errorMsg}`,
			});
		}
	};

	const handleSaveLlmConfig = async () => {
		const currentApiKey = llmApiKey.trim();
		const currentBaseUrl = llmBaseUrl.trim();
		const currentModel = llmModel.trim();

		const llmCoreConfigChanged =
			currentApiKey !== initialLlmConfig.llmApiKey ||
			currentBaseUrl !== initialLlmConfig.llmBaseUrl ||
			currentModel !== initialLlmConfig.llmModel;

		const otherConfigChanged =
			llmTemperature !== initialLlmConfig.llmTemperature ||
			llmMaxTokens !== initialLlmConfig.llmMaxTokens;

		if (!llmCoreConfigChanged && !otherConfigChanged) {
			return;
		}

		try {
			await saveConfigMutation.mutateAsync({
				data: {
					llmApiKey: currentApiKey,
					llmBaseUrl: currentBaseUrl,
					llmModel: currentModel,
					llmTemperature,
					llmMaxTokens,
				},
			});

			setInitialLlmConfig({
				llmApiKey: currentApiKey,
				llmBaseUrl: currentBaseUrl,
				llmModel: currentModel,
				llmTemperature,
				llmMaxTokens,
			});

			if (llmCoreConfigChanged && currentApiKey && currentBaseUrl) {
				try {
					const result = await saveAndInitLlmMutation.mutateAsync({
						data: {
							llmApiKey: currentApiKey,
							llmBaseUrl: currentBaseUrl,
							llmModel: currentModel,
						},
					});

					const response = result as { success?: boolean; error?: string };
					if (response.success) {
						setTestMessage({
							type: "success",
							text: t("testSuccess"),
						});
						await queryClient.invalidateQueries({ queryKey: ["llm-status"] });
					} else {
						setTestMessage({
							type: "error",
							text: `${t("testFailed")}: ${response.error || "Unknown error"}`,
						});
					}
				} catch (initError) {
					const errorMsg =
						initError instanceof Error ? initError.message : String(initError);
					setTestMessage({
						type: "error",
						text: `${t("testFailed")}: ${errorMsg}`,
					});
					console.warn("LLM 初始化失败，配置已保存:", initError);
				}
			}
		} catch (error) {
			console.error("保存 LLM 配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t("saveFailed", { error: errorMsg }));
		}
	};

	return (
		<SettingsSection title={t("llmConfig")}>
			<div className="space-y-4">
				{/* Status message */}
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
					<label
						htmlFor="llm-api-key"
						className="block text-[13px] font-medium text-foreground/80"
					>
						{t("apiKey")} <span className="text-destructive">*</span>
					</label>
					<input
						id="llm-api-key"
						type="password"
						className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
						placeholder={t("apiKey")}
						value={llmApiKey}
						onChange={(e) => setLlmApiKey(e.target.value)}
						onBlur={handleSaveLlmConfig}
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
					<label
						htmlFor="llm-base-url"
						className="block text-[13px] font-medium text-foreground/80"
					>
						{t("baseUrl")} <span className="text-destructive">*</span>
					</label>
					<input
						id="llm-base-url"
						type="text"
						className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
						placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
						value={llmBaseUrl}
						onChange={(e) => setLlmBaseUrl(e.target.value)}
						onBlur={handleSaveLlmConfig}
						disabled={isLoading}
					/>
				</div>

				{/* Model / Temperature / Max Tokens */}
				<div className="rounded-xl border border-border/40 bg-muted/20 p-3 sm:p-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div className="space-y-1.5">
							<label
								htmlFor="llm-model"
								className="block text-[13px] font-medium text-foreground/80"
							>
								{t("model")}
							</label>
							<input
								id="llm-model"
								type="text"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="qwen-plus"
								value={llmModel}
								onChange={(e) => setLlmModel(e.target.value)}
								onBlur={handleSaveLlmConfig}
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-1.5">
							<label
								htmlFor="llm-temperature"
								className="block text-[13px] font-medium text-foreground/80"
							>
								{t("temperature")}
							</label>
							<input
								id="llm-temperature"
								type="number"
								step="0.1"
								min="0"
								max="2"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								value={llmTemperature}
								onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
								onBlur={handleSaveLlmConfig}
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-1.5">
							<label
								htmlFor="llm-max-tokens"
								className="block text-[13px] font-medium text-foreground/80"
							>
								{t("maxTokens")}
							</label>
							<input
								id="llm-max-tokens"
								type="number"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								value={llmMaxTokens}
								onChange={(e) => setLlmMaxTokens(parseInt(e.target.value, 10))}
								onBlur={handleSaveLlmConfig}
								disabled={isLoading}
							/>
						</div>
					</div>
				</div>

				{/* Test button */}
				<button
					type="button"
					onClick={async () => {
						if (document.activeElement instanceof HTMLElement) {
							document.activeElement.blur();
						}
						await new Promise((resolve) => setTimeout(resolve, 50));
						await handleTestLlm();
					}}
					disabled={isLoading || !llmApiKey.trim() || !llmBaseUrl.trim()}
					className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
				>
					{testLlmMutation.isPending
						? `${t("testConnection")}...`
						: t("testConnection")}
				</button>
			</div>
		</SettingsSection>
	);
}
