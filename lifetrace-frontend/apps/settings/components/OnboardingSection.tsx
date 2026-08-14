"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOnboardingTour } from "@/lib/hooks/useOnboardingTour";
import { SettingsSection } from "./SettingsSection";

interface OnboardingSectionProps {
	loading?: boolean;
}

export function OnboardingSection({ loading = false }: OnboardingSectionProps) {
	const t = useTranslations("onboarding");
	const { restartTour } = useOnboardingTour();

	return (
		<SettingsSection title={t("restartTour")}>
			<div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3">
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0 flex-1">
						<p className="text-[13px] font-medium text-foreground/90">
							{t("restartTour")}
						</p>
						<p className="mt-0.5 text-xs text-muted-foreground/60">
							{t("restartTourDescription")}
						</p>
					</div>
					<button
						type="button"
						onClick={restartTour}
						disabled={loading}
						className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3.5 py-2 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
					>
						<RotateCcw className="h-3.5 w-3.5" />
						{t("restartTour")}
					</button>
				</div>
			</div>
		</SettingsSection>
	);
}
