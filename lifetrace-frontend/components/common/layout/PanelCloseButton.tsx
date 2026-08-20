"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	PanelActionButton,
	usePanelPosition,
} from "@/components/common/layout/PanelHeader";
import { useUiStore } from "@/lib/store/ui-store";

/**
 * 面板右上角关闭按钮
 * 根据所在面板位置自动关闭对应槽位（宽度由 PanelRegion 自动重新分配）
 */
export function PanelCloseButton() {
	const t = useTranslations("panelMenu");
	const position = usePanelPosition();
	const togglePanelA = useUiStore((state) => state.togglePanelA);
	const togglePanelB = useUiStore((state) => state.togglePanelB);
	const togglePanelC = useUiStore((state) => state.togglePanelC);

	if (!position) {
		return null;
	}

	const handleClose = () => {
		if (position === "panelA") {
			togglePanelA();
		} else if (position === "panelB") {
			togglePanelB();
		} else {
			togglePanelC();
		}
	};

	return (
		<PanelActionButton
			variant="default"
			icon={X}
			onClick={handleClose}
			aria-label={t("closePanel")}
		/>
	);
}
