"use client";

import {
	ChevronLeft,
	ChevronRight,
	LayoutGrid,
	LifeBuoy,
	Settings,
	Sparkles,
	Wrench,
	Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PanelHeader } from "@/components/common/layout/PanelHeader";
import { useConfig } from "@/lib/query";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import {
	AppearanceSection,
	AudioAsrConfigSection,
	AudioConfigSection,
	AutomationTasksSection,
	AutoTodoDetectionSection,
	InboxDraftSettingsSection,
	JournalSettingsSection,
	LlmConfigSection,
	NotificationPermissionSection,
	OnboardingSection,
	SchedulerSection,
	type SettingsCategory,
	type SettingsCategoryId,
	SettingsSection,
	TavilyConfigSection,
	TimeMachineStyleSection,
	VersionInfoSection,
} from "./components";

const SETTINGS_CATEGORY_IDS: SettingsCategoryId[] = [
	"ai",
	"workspace",
	"automation",
	"developer",
	"help",
];

/**
 * 设置面板组件
 * 桌面端：左侧分类菜单 + 右侧内容
 * 移动端：一级分类列表 -> 点击进入二级内容
 */
export function SettingsPanel() {
	const tPage = useTranslations("page");
	const tSettings = useTranslations("page.settings");

	// 使用 TanStack Query 获取配置
	const { data: config, isLoading: configLoading } = useConfig();

	// 获取面板启用状态
	const isFeatureEnabled = useUiStore((state) => state.isFeatureEnabled);
	const isAudioPanelEnabled = isFeatureEnabled("audio");
	const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);

	const categories: SettingsCategory[] = [
		{
			id: "ai",
			label: tSettings("categoryAiTitle"),
			description: tSettings("categoryAiDescription"),
			icon: Sparkles,
		},
		{
			id: "workspace",
			label: tSettings("categoryWorkspaceTitle"),
			description: tSettings("categoryWorkspaceDescription"),
			icon: LayoutGrid,
		},
		{
			id: "automation",
			label: tSettings("categoryAutomationTitle"),
			description: tSettings("categoryAutomationDescription"),
			icon: Zap,
		},
		{
			id: "developer",
			label: tSettings("categoryDeveloperTitle"),
			description: tSettings("categoryDeveloperDescription"),
			icon: Wrench,
		},
		{
			id: "help",
			label: tSettings("categoryHelpTitle"),
			description: tSettings("categoryHelpDescription"),
			icon: LifeBuoy,
		},
	];

	const [activeCategory, setActiveCategory] =
		useState<SettingsCategoryId>("workspace");
	// 移动端导航：menu = 一级分类列表，content = 二级内容
	const [mobileView, setMobileView] = useState<"menu" | "content">("menu");
	const contentRef = useRef<HTMLDivElement | null>(null);

	const loading = configLoading;
	const activeCategoryMeta = categories.find(
		(category) => category.id === activeCategory,
	);

	useEffect(() => {
		const handleSetCategory = (
			event: CustomEvent<{ category?: SettingsCategoryId }>,
		) => {
			const nextCategory = event.detail?.category;
			if (nextCategory && SETTINGS_CATEGORY_IDS.includes(nextCategory)) {
				setActiveCategory(nextCategory);
				setMobileView("content");
			}
		};

		window.addEventListener(
			"settings:set-category",
			handleSetCategory as EventListener,
		);
		return () => {
			window.removeEventListener(
				"settings:set-category",
				handleSetCategory as EventListener,
			);
		};
	}, []);

	// 切换分类 / 移动端进入二级内容时回到顶部
	useEffect(() => {
		contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	}, [activeCategory, mobileView]);

	// 移动端返回：二级内容回到一级菜单，一级菜单关闭设置
	const handleMobileBack = () => {
		if (mobileView === "content") {
			setMobileView("menu");
		} else {
			setSettingsOpen(false);
		}
	};

	const renderCategoryContent = (categoryId: SettingsCategoryId) => {
		switch (categoryId) {
			case "workspace":
				return (
					<>
						<AppearanceSection />
						<TimeMachineStyleSection />
						<InboxDraftSettingsSection />
						<NotificationPermissionSection loading={loading} />
					</>
				);
			case "automation":
				return (
					<>
						<JournalSettingsSection />
						<AutoTodoDetectionSection config={config} loading={loading} />
						<AutomationTasksSection loading={loading} />
					</>
				);
			case "ai":
				return (
					<>
						<LlmConfigSection config={config} loading={loading} />
						<TavilyConfigSection config={config} loading={loading} />
					</>
				);
			case "developer":
				return (
					<>
						{/* <DifyConfigSection config={config} loading={loading} /> */}
						<SchedulerSection loading={loading} />
						{isAudioPanelEnabled && (
							<>
								<AudioConfigSection config={config} loading={loading} />
								<AudioAsrConfigSection config={config} loading={loading} />
							</>
						)}
					</>
				);
			case "help":
				return (
					<>
						<OnboardingSection loading={loading} />
						<SettingsSection
							title={tSettings("aboutTitle")}
							description={tSettings("aboutDescription")}
						>
							<VersionInfoSection />
						</SettingsSection>
					</>
				);
			default:
				return null;
		}
	};

	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-background">
			{/* 顶部标题栏（移动端标题左侧为返回按钮） */}
			<PanelHeader
				icon={Settings}
				title={tPage("settingsLabel")}
				leading={
					<button
						type="button"
						onClick={handleMobileBack}
						aria-label={
							mobileView === "content"
								? tSettings("backToMenu")
								: tSettings("closeSettings")
						}
						className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground active:scale-95 md:hidden"
					>
						<ChevronLeft className="h-5 w-5" />
					</button>
				}
			/>

			{/* 内容区：桌面侧栏 + 内容列（移动端一级菜单时整块隐藏，避免空容器占位） */}
			<div
				className={cn(
					"min-h-0 flex-1",
					mobileView === "menu" ? "hidden md:flex" : "flex",
				)}
			>
				{/* 左侧分类菜单（桌面端） */}
				<nav
					role="tablist"
					aria-orientation="vertical"
					aria-label={tPage("settingsLabel")}
					className="hidden w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/60 bg-muted/20 p-2.5 md:flex"
				>
					{categories.map((category) => {
						const isActive = category.id === activeCategory;
						const Icon = category.icon;

						return (
							<button
								key={category.id}
								type="button"
								role="tab"
								id={`settings-category-tab-${category.id}`}
								aria-selected={isActive}
								aria-controls={`settings-category-panel-${category.id}`}
								onClick={() => setActiveCategory(category.id)}
								className={cn(
									"flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.98]",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									isActive
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
							>
								<Icon className="h-4 w-4" />
								<span className="truncate">{category.label}</span>
							</button>
						);
					})}
				</nav>

				{/* 右侧内容列（桌面常显；移动端二级内容时显示） */}
				<div
					data-tour="settings-content"
					ref={contentRef}
					role="tabpanel"
					id={`settings-category-panel-${activeCategory}`}
					aria-labelledby={`settings-category-tab-${activeCategory}`}
					className={cn(
						"min-w-0 flex-1 overflow-y-auto",
						mobileView === "menu" && "hidden md:block",
					)}
				>
					<div className="px-4 py-4 md:px-5 md:py-5">
						{/* 分类标题（根据当前内容联动） */}
						<div className="mb-5">
							<h3 className="text-base font-semibold text-foreground">
								{activeCategoryMeta?.label}
							</h3>
							{activeCategoryMeta?.description && (
								<p className="mt-1 text-sm text-muted-foreground">
									{activeCategoryMeta.description}
								</p>
							)}
						</div>

						<div className="space-y-6">
							{renderCategoryContent(activeCategory)}
						</div>
					</div>
				</div>
			</div>

			{/* 移动端一级分类菜单 */}
			{mobileView === "menu" && (
				<div className="min-h-0 flex-1 overflow-y-auto md:hidden">
					<div className="space-y-1.5 p-4">
						{categories.map((category) => {
							const Icon = category.icon;

							return (
								<button
									key={category.id}
									type="button"
									onClick={() => {
										setActiveCategory(category.id);
										setMobileView("content");
									}}
									className="flex w-full items-center gap-3.5 rounded-xl border border-border/60 bg-background px-4 py-4 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
								>
									<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<Icon className="h-5 w-5" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-sm font-medium text-foreground">
											{category.label}
										</span>
										<span className="mt-0.5 block truncate text-xs text-muted-foreground">
											{category.description}
										</span>
									</span>
									<ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

// 兼容默认导出，避免构建器找不到导出时报错
export default SettingsPanel;
