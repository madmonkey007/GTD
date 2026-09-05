"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SettingsSection } from "./SettingsSection";

// 统一 commit 显示长度（git 短哈希约定 7 位），避免副标题与完整版本串位数不一致
const COMMIT_LEN = 7;

export function VersionInfoSection() {
	const t = useTranslations("page.settings");

	const version = process.env.NEXT_PUBLIC_APP_VERSION || "unknown";
	const buildType = process.env.NEXT_PUBLIC_BUILD_TYPE || "unknown";
	// 构建时注入的 commit 作为初始值/回退值（生产打包环境无 git 时依赖它）
	const buildCommit = process.env.NEXT_PUBLIC_GIT_COMMIT || "unknown";

	// dev 下从运行时接口拉取最新 HEAD，避免 next.config.ts 构建时 baked 的 commit 过期
	const [commit, setCommit] = useState(buildCommit);

	useEffect(() => {
		let cancelled = false;
		fetch("/version", { cache: "no-store" })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (!cancelled && typeof data?.commit === "string" && data.commit) {
					setCommit(data.commit);
				}
			})
			.catch(() => {
				// 接口不可用（静态导出/打包环境）时保留构建时回退值
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const shortCommit = commit.slice(0, COMMIT_LEN);
	const versionString = `${version}_${buildType}_${shortCommit}`;

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
								{buildType} &middot; {shortCommit}
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
