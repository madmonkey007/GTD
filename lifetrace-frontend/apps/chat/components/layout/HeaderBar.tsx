"use client";

import { History, PlusCircle, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { PanelActionButton } from "@/components/common/layout/PanelHeader";

type HeaderBarProps = {
	chatHistoryLabel: string;
	newChatLabel: string;
	onToggleHistory: () => void;
	onNewChat: () => void;
};

export function HeaderBar({
	chatHistoryLabel,
	newChatLabel,
	onToggleHistory,
	onNewChat,
}: HeaderBarProps) {
	const t = useTranslations("page");

	return (
		<div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/30">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
						<Sparkles className="w-3.5 h-3.5 text-primary/60" />
					</div>
					<span className="text-sm font-semibold tracking-tight text-foreground/80">
						{t("chatLabel")}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<PanelActionButton
						variant="default"
						icon={History}
						onClick={onToggleHistory}
						aria-label={chatHistoryLabel}
					/>
					<PanelActionButton
						variant="default"
						icon={PlusCircle}
						onClick={onNewChat}
						aria-label={newChatLabel}
					/>
				</div>
			</div>
		</div>
	);
}
