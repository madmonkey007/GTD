"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

interface IntlErrorBoundaryProps {
	messages: AbstractIntlMessages;
	locale: string;
	children: React.ReactNode;
}

export function IntlErrorBoundary({
	messages,
	locale,
	children,
}: IntlErrorBoundaryProps) {
	return (
		<NextIntlClientProvider
			locale={locale}
			messages={messages}
			onError={(error) => {
				if (
					error.code === "MISSING_MESSAGE" &&
					error.message?.includes("journalPanel")
				) {
					return;
				}
				console.error(error);
			}}
		>
			{children}
		</NextIntlClientProvider>
	);
}
