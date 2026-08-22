"use client";

import { Clock, List, Shuffle, Sparkles, TimerReset } from "lucide-react";
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import type { DiaryFilterMode } from "@/apps/diary/hooks/useDiaryStats";
import { useMobileToolbarStore } from "@/lib/store/mobile-toolbar-store";
import { cn } from "@/lib/utils";

interface DiaryFilterBarProps {
	filterMode: DiaryFilterMode;
	onFilterModeChange: (mode: DiaryFilterMode) => void;
	/** 处于项目视图等无筛选语义的场景时，隐藏所有选项的高亮态 */
	hideActive?: boolean;
	/** 时光机是否激活（正在穿越 / 动画中） */
	timeMachineActive?: boolean;
	/** 点击时光机器 tab */
	onTimeMachine?: () => void;
}

const FILTERS: { key: DiaryFilterMode; disabled?: boolean; icon: React.FC<{ className?: string }> }[] = [
	{ key: "all", icon: List },
	{ key: "last7", icon: Clock },
	{ key: "random", icon: Shuffle },
];

export function DiaryFilterBar({ filterMode, onFilterModeChange, hideActive, timeMachineActive, onTimeMachine }: DiaryFilterBarProps) {
	const t = useTranslations("journalPanel");

	return (
		<div className="flex flex-col gap-0.5">
			{FILTERS.map(({ key, disabled, icon: Icon }) => {
				const isActive = !hideActive && !timeMachineActive && filterMode === key;
				const labelKey =
					key === "all"
						? "sidebarFilterAll"
						: key === "last7"
							? "sidebarFilterLast7"
							: "sidebarFilterRandom";
				const tooltipKey =
					key === "random" ? "sidebarFilterRandomTooltip" : undefined;

				return (
					<Fragment key={key}>
						<button
							type="button"
							disabled={disabled}
							title={tooltipKey ? t(tooltipKey) : undefined}
							onClick={() => onFilterModeChange(key)}
							className={cn(
								"rounded-lg px-2 py-1.5 text-sm transition-colors w-full text-left flex items-center gap-1.5",
								isActive
									? "bg-primary/8 text-primary font-medium border border-primary/15"
									: "text-muted-foreground/70 hover:bg-muted/20 hover:text-foreground",
								disabled && "cursor-not-allowed opacity-40",
							)}
						>
							<Icon className="w-3.5 h-3.5 shrink-0" />
							{t(labelKey)}
						</button>
						{/* 时光机器：插入在随机漫步之后 */}
						{key === "random" && onTimeMachine && (
							<button
								type="button"
								onClick={onTimeMachine}
								title={t("timeMachineTooltip")}
								className={cn(
									"rounded-lg px-2 py-1.5 text-sm transition-colors w-full text-left flex items-center gap-1.5",
									!hideActive && timeMachineActive
										? "bg-primary/8 text-primary font-medium border border-primary/15"
										: "text-muted-foreground/70 hover:bg-muted/20 hover:text-foreground",
								)}
							>
								<TimerReset className="w-3.5 h-3.5 shrink-0" />
								{t("timeMachine")}
							</button>
						)}
						{/* AI 洞察：打开右侧对话面板 */}
						{key === "random" && (
							<button
								type="button"
								title="AI 洞察"
								onClick={() => useMobileToolbarStore.getState().setDiaryRightOpen(true)}
								className="rounded-lg px-2 py-1.5 text-sm transition-colors w-full text-left flex items-center gap-1.5 text-muted-foreground/70 hover:bg-muted/20 hover:text-foreground"
							>
								<Sparkles className="w-3.5 h-3.5 shrink-0" />
								{t("aiInsight")}
							</button>
						)}
					</Fragment>
				);
			})}
		</div>
	);
}
