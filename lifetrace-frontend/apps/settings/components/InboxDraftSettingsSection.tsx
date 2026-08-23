"use client";

import { useTranslations } from "next-intl";
import { useInboxDraftStore } from "@/lib/store/inbox-draft-store";
import { SettingsSection } from "./SettingsSection";

/** 收集箱草稿设置：失效时间（小时），过期的本地草稿自动清理 */
export function InboxDraftSettingsSection() {
	const t = useTranslations("page.settings");
	const expiryHours = useInboxDraftStore((s) => s.expiryHours);
	const setExpiryHours = useInboxDraftStore((s) => s.setExpiryHours);

	return (
		<SettingsSection
			title={t("inboxDraftTitle")}
			description={t("inboxDraftDescription")}
			searchKeywords={[t("inboxDraftTitle"), t("inboxDraftDescription")]}
		>
			<div className="flex items-center justify-between gap-4">
				<span className="text-sm font-medium text-foreground">
					{t("inboxDraftExpiryLabel")}
				</span>
				<div className="flex items-center gap-2">
					<input
						type="number"
						min={1}
						max={720}
						value={expiryHours}
						onChange={(e) => {
							const v = Number(e.target.value);
							if (Number.isFinite(v) && v > 0) setExpiryHours(Math.min(720, Math.round(v)));
						}}
						className="h-8 w-20 rounded-lg border border-border/50 bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-primary/40"
						aria-label={t("inboxDraftExpiryLabel")}
					/>
					<span className="text-xs text-muted-foreground">{t("inboxDraftExpiryUnit")}</span>
				</div>
			</div>
		</SettingsSection>
	);
}
