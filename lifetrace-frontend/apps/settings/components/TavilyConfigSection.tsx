"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Check } from "lucide-react";
import { useSaveConfig } from "@/lib/query";
import { SettingsSection } from "./SettingsSection";

interface TavilyConfigSectionProps {
	config: Record<string, unknown> | undefined;
	loading?: boolean;
}

export function TavilyConfigSection({
	config,
	loading = false,
}: TavilyConfigSectionProps) {
	const t = useTranslations("page.settings");
	const saveConfigMutation = useSaveConfig();

	const [tavilyApiKey, setTavilyApiKey] = useState(
		(config?.tavilyApiKey as string) || "",
	);
	const [verifyStatus, setVerifyStatus] = useState<
		"idle" | "success" | "error"
	>("idle");

	const handleSave = async () => {
		if (!tavilyApiKey.trim()) return;

		try {
			await saveConfigMutation.mutateAsync({
				data: {
					tavilyApiKey: tavilyApiKey.trim(),
				},
			});
			setVerifyStatus("success");
		} catch {
			setVerifyStatus("error");
		}
	};

	return (
		<SettingsSection title={t("tavilyConfigTitle")}>
			<div className="space-y-3">
				<p className="text-xs leading-relaxed text-muted-foreground/60">
					{t("tavilyDescription")}
				</p>

				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="relative flex-1">
						<input
							type="password"
							className="min-h-[44px] w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 pr-9 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
							placeholder="tvly-xxxxxxxxxx"
							value={tavilyApiKey}
							onChange={(e) => {
								setTavilyApiKey(e.target.value);
								setVerifyStatus("idle");
							}}
							disabled={loading || saveConfigMutation.isPending}
						/>
						{verifyStatus === "success" && (
							<span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500">
								<Check className="h-4 w-4" strokeWidth={2.5} />
							</span>
						)}
					</div>

					<button
						type="button"
						onClick={handleSave}
						disabled={
							loading ||
							saveConfigMutation.isPending ||
							!tavilyApiKey.trim()
						}
						className="min-h-[44px] shrink-0 rounded-lg border border-border/60 bg-background/50 px-4 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
					>
						{saveConfigMutation.isPending ? "..." : t("verify")}
					</button>
				</div>
			</div>
		</SettingsSection>
	);
}
