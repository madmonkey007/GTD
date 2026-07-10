"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type WelcomeGreetingsProps = {
	className?: string;
};

export function WelcomeGreetings({
	className,
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
				<div className="relative">
					<div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center ring-1 ring-primary/10">
						<Sparkles className="w-7 h-7 text-primary/60" />
					</div>
					<div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center">
						<div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
					</div>
				</div>

				<div className="space-y-1.5">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						{title}
					</h1>
					<p className="text-sm text-muted-foreground/70 leading-relaxed max-w-[280px]">
						{subtitle}
					</p>
				</div>
			</div>
		</motion.div>
	);
}
