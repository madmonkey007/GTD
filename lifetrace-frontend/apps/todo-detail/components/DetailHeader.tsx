"use client";

import { ArrowLeft, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import { PanelCloseButton } from "@/components/common/layout/PanelCloseButton";
import { useMobileDetail } from "@/components/layout/MobileDetailOverlay";
import { cn } from "@/lib/utils";

interface DetailHeaderProps {
	activeView: "detail" | "artifacts";
	onViewChange: (view: "detail" | "artifacts") => void;
	/** 面板标题显示的待办名称（无待办时回退为「待办详情」） */
	todoName?: string;
}

export function DetailHeader({
	activeView,
	onViewChange,
	todoName,
}: DetailHeaderProps) {
	const t = useTranslations("page");
	const tTodoDetail = useTranslations("todoDetail");
	const mobile = useMobileDetail();

	return (
		<PanelHeader
			icon={FileText}
			title={todoName ?? t("todoDetailLabel")}
			hideMenu
			leading={
				mobile && (
					<button
						type="button"
						onClick={mobile.onBack}
						aria-label={tTodoDetail("backToList")}
						className="flex h-9 w-9 -ml-2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
					>
						<ArrowLeft className="h-5 w-5" />
					</button>
				)
			}
			actions={
				<>
					<div className="flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5 text-xs">
						<button
							type="button"
							onClick={() => onViewChange("detail")}
							className={cn(
								"rounded-[5px] px-2.5 py-1 font-medium transition-all",
								activeView === "detail"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tTodoDetail("detailViewLabel")}
						</button>
						<button
							type="button"
							onClick={() => onViewChange("artifacts")}
							className={cn(
								"rounded-[5px] px-2.5 py-1 font-medium transition-all",
								activeView === "artifacts"
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{tTodoDetail("artifactsViewLabel")}
						</button>
					</div>
					<PanelCloseButton />
				</>
			}
		/>
	);
}
