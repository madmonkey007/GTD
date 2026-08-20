"use client";

import { History, PlusCircle, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { PanelActionButton } from "@/components/common/layout/PanelHeader";
import { PanelCloseButton } from "@/components/common/layout/PanelCloseButton";

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
		<div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Sparkles className="w-4 h-4 text-primary/70" />
					<span className="text-sm font-semibold tracking-tight text-foreground">
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
					<PanelCloseButton />
				</div>
			</div>
		</div>
	);
}
