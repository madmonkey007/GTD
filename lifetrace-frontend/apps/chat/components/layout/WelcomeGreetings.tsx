"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type WelcomeGreetingsProps = {
	className?: string;
	children?: React.ReactNode;
};

export function WelcomeGreetings({
	className,
	children,
}: WelcomeGreetingsProps) {
	const tChat = useTranslations("chat");

	const title = tChat("greetings.title");
	const subtitle = tChat("greetings.subtitle");

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
			className={cn(
				"flex flex-1 flex-col items-center justify-center px-6",
				className,
			)}
		>
			<div className="flex flex-col items-center gap-5 text-center">
				<div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
					<Sparkles className="w-5.5 h-5.5 text-primary/60" />
				</div>

				<div className="space-y-1.5">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{title}
					</h1>
					<p className="text-sm text-muted-foreground/70 leading-relaxed max-w-[280px]">
						{subtitle}
					</p>
				</div>

				{children && (
					<div className="w-full max-w-md pt-4">{children}</div>
				)}
			</div>
		</motion.div>
	);
}
