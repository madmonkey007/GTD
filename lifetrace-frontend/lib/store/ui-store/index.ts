// 类型导出

// 布局预设导出
export { LAYOUT_PRESETS } from "./layout-presets";
// Store 导出
export { useUiStore } from "./store";
export type { LayoutPreset, UiStoreState } from "./types";
// 工具函数导出
export {
	clampWidth,
	DEFAULT_PANEL_STATE,
	getPositionByFeature,
	MAX_PANEL_WIDTH,
	MIN_PANEL_WIDTH,
	validatePanelFeatureMap,
} from "./utils";
