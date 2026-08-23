import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Noto_Serif_SC, Plus_Jakarta_Sans } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/common/theme/ThemeProvider";
import { AuthGate } from "@/components/common/ui/AuthGate";
import { BackendReadyGate } from "@/components/common/ui/BackendReadyGate";
import { IntlErrorBoundary } from "@/components/common/ui/IntlErrorBoundary";
import { LocaleSync } from "@/components/common/ui/LocaleSync";
import { OfflineBadge } from "@/components/common/ui/OfflineBadge";
import { PwaRegister } from "@/components/common/ui/PwaRegister";
import { ScrollbarController } from "@/components/common/ui/ScrollbarController";
import { SyncController } from "@/components/common/ui/SyncController";
import { QueryProvider } from "@/lib/query/provider";
import "./globals.css";
import "driver.js/dist/driver.css";

interface RootLayoutProps {
	children: React.ReactNode;
}

// 自托管字体（构建时下载，从本站域名分发）：
// 此前用 CSS @import 拉 Google Fonts，国内网络不可达时全部退化为系统 fallback，云端观感差
const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-jakarta",
	display: "swap",
});
const notoSansSC = Noto_Sans_SC({
	weight: ["400", "500", "700"],
	variable: "--font-noto-sans",
	display: "swap",
	preload: false,
});
const notoSerifSC = Noto_Serif_SC({
	weight: ["600"],
	variable: "--font-noto-serif",
	display: "swap",
	preload: false,
});

export const metadata: Metadata = {
	title: "GTD",
	description: "A todo app that tracks your life.",
	manifest: "/manifest.json",
	other: {
		"theme-color": "#fafafa",
		"apple-mobile-web-app-capable": "yes",
	},
	icons: {
		apple: "/icon-192x192.png",
	},
};

export const viewport: Viewport = {
	width: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: "cover",
};

export default async function RootLayout({ children }: RootLayoutProps) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html lang={locale} suppressHydrationWarning>
			<body
				className={`${jakarta.variable} ${notoSansSC.variable} ${notoSerifSC.variable} min-h-screen bg-background text-foreground antialiased`}
				suppressHydrationWarning
			>
				{/* 预览：小米官方 MiSans 字体（国内可达 CDN）。仅用于对比效果；若采纳，换为自托管 woff2 */}
				<link
					rel="stylesheet"
					href="https://font.sec.miui.com/font/css?family=MiSans:400,500,700:Chinese_Simplify,Latin&display=swap"
				/>
				<ScrollbarController />
				<PwaRegister />
				<SyncController />
				<QueryProvider>
					<OfflineBadge />
					<IntlErrorBoundary messages={messages} locale={locale}>
						<LocaleSync />
						<ThemeProvider>
							<BackendReadyGate>
								<AuthGate>{children}</AuthGate>
							</BackendReadyGate>
						</ThemeProvider>
					</IntlErrorBoundary>
				</QueryProvider>
			</body>
		</html>
	);
}
