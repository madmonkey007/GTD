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
			{/* 常用时长快捷设置 */}
			<div className="flex flex-wrap items-center gap-1.5">
				{[12, 24, 48, 72].map((h) => (
					<button
						key={h}
						type="button"
						onClick={() => setExpiryHours(h)}
						className={
							"rounded-full border px-2.5 py-1 text-xs transition-colors " +
							(expiryHours === h
								? "border-primary/40 bg-primary/10 text-primary"
								: "border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground")
						}
					>
						{h} {t("inboxDraftExpiryUnit")}
					</button>
				))}
			</div>
		</SettingsSection>
	);
}
