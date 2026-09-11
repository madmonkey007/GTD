"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useTestLlmConfigApiTestLlmConfigPost } from "@/lib/generated/config/config";
import { useSaveConfig } from "@/lib/query";
import { toastError } from "@/lib/toast";
import { SettingsSection } from "./SettingsSection";

interface TitleLlmConfigSectionProps {
	config: Record<string, unknown> | undefined;
	loading?: boolean;
}

export function TitleLlmConfigSection({
	config,
	loading = false,
}: TitleLlmConfigSectionProps) {
	const t = useTranslations("page.settings");
	const saveConfigMutation = useSaveConfig();
	const testLlmMutation = useTestLlmConfigApiTestLlmConfigPost();

	const [titleLlmEnabled, setTitleLlmEnabled] = useState(
		Boolean(config?.titleLlmApiKey),
	);
	const [titleLlmApiKey, setTitleLlmApiKey] = useState(
		(config?.titleLlmApiKey as string) || "",
	);
	const [titleLlmBaseUrl, setTitleLlmBaseUrl] = useState(
		(config?.titleLlmBaseUrl as string) || "",
	);
	const [titleLlmModel, setTitleLlmModel] = useState(
		(config?.titleLlmModel as string) || "qwen3-8b",
	);
	const [testMessage, setTestMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);
	const [initialValue, setInitialValue] = useState({
		titleLlmApiKey: (config?.titleLlmApiKey as string) || "",
		titleLlmBaseUrl: (config?.titleLlmBaseUrl as string) || "",
		titleLlmModel: (config?.titleLlmModel as string) || "qwen3-8b",
	});

	const isLoading =
		loading ||
		saveConfigMutation.isPending ||
		testLlmMutation.isPending;

	useEffect(() => {
		if (config) {
			const hasKey = Boolean(config.titleLlmApiKey);
			setTitleLlmEnabled(hasKey);
			if (config.titleLlmApiKey !== undefined) {
				setTitleLlmApiKey((config.titleLlmApiKey as string) || "");
			}
			if (config.titleLlmBaseUrl !== undefined) {
				setTitleLlmBaseUrl((config.titleLlmBaseUrl as string) || "");
			}
			if (config.titleLlmModel !== undefined) {
				setTitleLlmModel((config.titleLlmModel as string) || "qwen3-8b");
			}
			setInitialValue({
				titleLlmApiKey: (config.titleLlmApiKey as string) || "",
				titleLlmBaseUrl: (config.titleLlmBaseUrl as string) || "",
				titleLlmModel: (config.titleLlmModel as string) || "qwen3-8b",
			});
		}
	}, [config]);

	const handleSave = async () => {
		const payload: Record<string, unknown> = {};

		if (titleLlmEnabled) {
			if (!titleLlmApiKey.trim() || !titleLlmBaseUrl.trim()) {
				toastError(t("apiKeyRequired"));
				return;
			}
			payload.titleLlmApiKey = titleLlmApiKey.trim();
			payload.titleLlmBaseUrl = titleLlmBaseUrl.trim();
			payload.titleLlmModel = titleLlmModel.trim() || "qwen3-8b";
		} else {
			// 关闭专用标题模型：清空配置，让后端回退复用主 LLM
			payload.titleLlmApiKey = "";
			payload.titleLlmBaseUrl = "";
			payload.titleLlmModel = "";
		}

		const changed =
			payload.titleLlmApiKey !== initialValue.titleLlmApiKey ||
			payload.titleLlmBaseUrl !== initialValue.titleLlmBaseUrl ||
			payload.titleLlmModel !== initialValue.titleLlmModel;
		if (!changed) return;

		try {
			await saveConfigMutation.mutateAsync({ data: payload });
			setInitialValue({
				titleLlmApiKey: (payload.titleLlmApiKey as string) || "",
				titleLlmBaseUrl: (payload.titleLlmBaseUrl as string) || "",
				titleLlmModel: (payload.titleLlmModel as string) || "qwen3-8b",
			});
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t("saveFailed", { error: errorMsg }));
		}
	};

	const handleTest = async () => {
		const currentApiKey = titleLlmApiKey.trim();
		const currentBaseUrl = titleLlmBaseUrl.trim();
		const currentModel = titleLlmModel.trim() || "qwen3-8b";

		if (!currentApiKey || !currentBaseUrl) {
			setTestMessage({ type: "error", text: t("apiKeyRequired") });
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
				setTestMessage({ type: "success", text: t("testSuccess") });
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

	return (
		<SettingsSection title={t("titleLlmConfig")}>
			<div className="space-y-4">
				<p className="text-xs leading-relaxed text-muted-foreground/60">
					{t("titleLlmDescription")}
				</p>

				{/* 启用开关 */}
				<label className="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						checked={titleLlmEnabled}
						onChange={(e) => {
							setTitleLlmEnabled(e.target.checked);
							if (!e.target.checked) {
								void handleSave();
							}
						}}
						disabled={isLoading}
						className="h-4 w-4 rounded border-border/60"
					/>
					<span className="text-[13px] font-medium text-foreground/80">
						{t("titleLlmUseDedicated")}
					</span>
				</label>

				{titleLlmEnabled && (
					<div className="space-y-4">
						{/* API Key */}
						<div className="space-y-1.5">
							<label
								htmlFor="title-llm-api-key"
								className="block text-[13px] font-medium text-foreground/80"
							>
								{t("apiKey")} <span className="text-destructive">*</span>
							</label>
							<input
								id="title-llm-api-key"
								type="password"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder={t("apiKey")}
								value={titleLlmApiKey}
								onChange={(e) => setTitleLlmApiKey(e.target.value)}
								disabled={isLoading}
							/>
						</div>

						{/* Base URL */}
						<div className="space-y-1.5">
							<label
								htmlFor="title-llm-base-url"
								className="block text-[13px] font-medium text-foreground/80"
							>
								{t("baseUrl")} <span className="text-destructive">*</span>
							</label>
							<input
								id="title-llm-base-url"
								type="text"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
								value={titleLlmBaseUrl}
								onChange={(e) => setTitleLlmBaseUrl(e.target.value)}
								disabled={isLoading}
							/>
						</div>

						{/* Model */}
						<div className="space-y-1.5">
							<label
								htmlFor="title-llm-model"
								className="block text-[13px] font-medium text-foreground/80"
							>
								{t("model")}
							</label>
							<input
								id="title-llm-model"
								type="text"
								className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
								placeholder="qwen3-8b"
								value={titleLlmModel}
								onChange={(e) => setTitleLlmModel(e.target.value)}
								disabled={isLoading}
							/>
						</div>

						{/* 测试结果提示 */}
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

						{/* 保存 + 测试按钮 */}
						<div className="flex flex-col gap-2 sm:flex-row">
							<button
								type="button"
								onClick={() => void handleSave()}
								disabled={
									isLoading ||
									!titleLlmApiKey.trim() ||
									!titleLlmBaseUrl.trim()
								}
								className="min-h-[44px] flex-1 rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
							>
								{saveConfigMutation.isPending
									? `${t("saving")}...`
									: t("save")}
							</button>
							<button
								type="button"
								onClick={async () => {
									if (document.activeElement instanceof HTMLElement) {
										document.activeElement.blur();
									}
									await new Promise((resolve) => setTimeout(resolve, 50));
									await handleTest();
								}}
								disabled={
									isLoading ||
									!titleLlmApiKey.trim() ||
									!titleLlmBaseUrl.trim()
								}
								className="min-h-[44px] flex-1 rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
							>
								{testLlmMutation.isPending
									? `${t("testConnection")}...`
									: t("testConnection")}
							</button>
						</div>
					</div>
				)}
			</div>
		</SettingsSection>
	);
}