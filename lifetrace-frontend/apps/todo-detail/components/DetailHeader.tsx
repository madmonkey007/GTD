"use client";

import { ArrowLeft, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import { useMobileDetail } from "@/components/layout/MobileDetailOverlay";
import { cn } from "@/lib/utils";

interface DetailHeaderProps {
	activeView: "detail" | "artifacts";
	onViewChange: (view: "detail" | "artifacts") => void;
}

export function DetailHeader({
	activeView,
	onViewChange,
}: DetailHeaderProps) {
	const t = useTranslations("page");
	const tTodoDetail = useTranslations("todoDetail");
	const mobile = useMobileDetail();

	return (
		<PanelHeader
			icon={FileText}
			title={t("todoDetailLabel")}
			hideMenu
			actions={
				<>
					{mobile && (
						<button
							type="button"
							onClick={mobile.onBack}
							aria-label={tTodoDetail("backToList")}
							className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
						>
							<ArrowLeft className="h-4.5 w-4.5" />
						</button>
					)}
					<div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">
						<button
							type="button"
							onClick={() => onViewChange("detail")}
							className={cn(
								"rounded-full px-2.5 py-1 font-medium transition-colors",
								activeView === "detail"
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tTodoDetail("detailViewLabel")}
						</button>
						<button
							type="button"
							onClick={() => onViewChange("artifacts")}
							className={cn(
								"rounded-full px-2.5 py-1 font-medium transition-colors",
								activeView === "artifacts"
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tTodoDetail("artifactsViewLabel")}
						</button>
					</div>
				</>
			}
		/>
	);
}
