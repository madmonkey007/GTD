"use client";

import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSaveConfig } from "@/lib/query";
import { toastError, toastSuccess } from "@/lib/toast";
import { SettingsSection } from "./SettingsSection";
import { ToggleSwitch } from "./ToggleSwitch";

interface AudioConfigSectionProps {
	config: Record<string, unknown> | undefined;
	loading?: boolean;
}

export function AudioConfigSection({
	config,
	loading = false,
}: AudioConfigSectionProps) {
	const t = useTranslations("page.settings");
	const saveConfigMutation = useSaveConfig();

	const [is24x7Enabled, setIs24x7Enabled] = useState<boolean>(
		(config?.audioIs24x7 as boolean | undefined) ?? false,
	);

	const isLoading = loading || saveConfigMutation.isPending;

	useEffect(() => {
		if (config && config.audioIs24x7 !== undefined) {
			setIs24x7Enabled((config.audioIs24x7 as boolean) ?? false);
		}
	}, [config]);

	const handleToggle24x7 = async (newValue: boolean) => {
		setIs24x7Enabled(newValue);
		try {
			await saveConfigMutation.mutateAsync({
				data: {
					audioIs24x7: newValue,
				},
			});
			toastSuccess(t("saveSuccess"));
		} catch (error) {
			setIs24x7Enabled(!newValue);
			console.error("保存自动启动录音配置失败:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			toastError(t("saveFailed", { error: errorMsg }));
		}
	};

	return (
		<SettingsSection title={t("audioSettings")}>
			<div
				className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
					is24x7Enabled
						? "border-primary/20 bg-primary/[0.03]"
						: "border-border/40 bg-card/30"
				}`}
			>
				<div className="flex items-center gap-3 min-w-0 flex-1">
					<div
						className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
							is24x7Enabled
								? "bg-primary/10 text-primary"
								: "bg-muted/40 text-muted-foreground/50"
						}`}
					>
						<Mic className="h-4 w-4" />
					</div>
					<div className="min-w-0">
						<p className="text-[13px] font-medium text-foreground/90">
							{t("enable24x7Recording")}
						</p>
						<p className="mt-0.5 text-xs text-muted-foreground/60">
							{t("enable24x7RecordingDesc")}
						</p>
					</div>
				</div>
				<ToggleSwitch
					enabled={is24x7Enabled}
					disabled={isLoading}
					onToggle={handleToggle24x7}
				/>
			</div>
		</SettingsSection>
	);
}
