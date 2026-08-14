"use client";

import { useTranslations } from "next-intl";
import { SettingsSection } from "./SettingsSection";

export function VersionInfoSection() {
	const t = useTranslations("page.settings");

	const version = process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
	const gitCommit = process.env.NEXT_PUBLIC_GIT_COMMIT || "unknown";
	const buildType = process.env.NEXT_PUBLIC_BUILD_TYPE || "unknown";

	const versionString = `${version}_${buildType}_${gitCommit}`;

	return (
		<SettingsSection title={t("currentVersion")}>
			<div className="rounded-xl border border-border/40 bg-card/30 px-4 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-semibold text-primary">
							v
						</div>
						<div>
							<p className="text-[13px] font-medium text-foreground/90">
								{version}
							</p>
							<p className="mt-0.5 text-xs text-muted-foreground/60">
								{buildType} &middot; {gitCommit.slice(0, 7)}
							</p>
						</div>
					</div>
					<code className="rounded-md bg-muted/40 px-2 py-1 text-[11px] tabular-nums text-muted-foreground/50">
						{versionString}
					</code>
				</div>
			</div>
		</SettingsSection>
	);
}
