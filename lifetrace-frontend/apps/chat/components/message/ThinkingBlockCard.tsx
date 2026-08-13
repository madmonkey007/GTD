"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ThinkBlock = { type: "think"; content: string };

type ThinkingBlockCardProps = {
	blocks: ThinkBlock[];
	isRunning: boolean;
	className?: string;
};

export function ThinkingBlockCard({ blocks, isRunning, className }: ThinkingBlockCardProps) {
	const t = useTranslations("chat.thinking");
	const [open, setOpen] = useState(false);

	if (!blocks || blocks.length === 0) return null;

	return (
		<>
			<style>{`
				@keyframes shimmerTextCard {
					0% { background-position: -200% center; }
					100% { background-position: 200% center; }
				}
			`}</style>
			<details
				className={cn("rounded-lg border border-border/40 bg-muted/20 px-3 py-2", className)}
				open={open}
				onToggle={(e) => setOpen(e.currentTarget.open)}
			>
				<summary className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors select-none list-none [&::-webkit-details-marker]:hidden [&::marker]:hidden group">
					{isRunning ? (
						<span
							className="relative inline-block font-medium"
							style={{
								background:
									"linear-gradient(90deg, currentColor 0%, currentColor 30%, rgba(255,255,255,0.8) 50%, currentColor 70%, currentColor 100%)",
								backgroundSize: "200% 100%",
								WebkitBackgroundClip: "text",
								WebkitTextFillColor: "transparent",
								backgroundClip: "text",
								animation: "shimmerTextCard 3s linear infinite",
							}}
						>
							{t("thinkingLabel")}
						</span>
					) : (
						<span>{t("processLabel")}</span>
					)}
					<svg
						className="w-3 h-3 transition-transform duration-200 group-open:rotate-90"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="m9 18 6-6-6-6" />
					</svg>
				</summary>
				<div className="mt-1.5 space-y-1.5">
					{blocks.map((b, i) => (
						<div
							key={i}
							className="pl-3 text-xs leading-relaxed text-muted-foreground/70 italic border-l-2 border-muted-foreground/20 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed"
						>
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{b.content}</ReactMarkdown>
						</div>
					))}
				</div>
			</details>
		</>
	);
}
