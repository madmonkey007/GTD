import type { Metadata, Viewport } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/common/theme/ThemeProvider";
import { AuthGate } from "@/components/common/ui/AuthGate";
import { BackendReadyGate } from "@/components/common/ui/BackendReadyGate";
import { IntlErrorBoundary } from "@/components/common/ui/IntlErrorBoundary";
import { LocaleSync } from "@/components/common/ui/LocaleSync";
import { OfflineBadge } from "@/components/common/ui/OfflineBadge";
import { PwaRegister } from "@/components/common/ui/PwaRegister";
import { ScrollbarController } from "@/components/common/ui/ScrollbarController";
import { QueryProvider } from "@/lib/query/provider";
import "./globals.css";
import "driver.js/dist/driver.css";

interface RootLayoutProps {
	children: React.ReactNode;
}

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
				className="min-h-screen bg-background text-foreground antialiased"
				suppressHydrationWarning
			>
				<ScrollbarController />
				<PwaRegister />
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
