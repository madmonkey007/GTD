"use client";

import { useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Play } from "lucide-react";

interface QuestionInputProps {
	onSubmit: (question: string) => void;
	onOpenBank: () => void;
}

export function QuestionInput({ onSubmit, onOpenBank }: QuestionInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isValid, setIsValid] = useState(false);

	// Validate on every input by reading the DOM value directly.
	// This works with all input methods including execCommand, IME, clipboard, keyboard.
	const handleInput = useCallback(() => {
		const value = textareaRef.current?.value || "";
		const valid = value.trim().length > 0;
		setIsValid(valid);
	}, []);

	const handleSubmit = useCallback(() => {
		const value = textareaRef.current?.value || "";
		const finalQuestion = value.trim();
		if (!finalQuestion) return;
		onSubmit(finalQuestion);
	}, [onSubmit]);

	return (
		<div className="min-h-[60vh] px-4">
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
				className="w-full max-w-2xl"
			>
				{/* Main input - underline style */}
				<div className="relative mb-8">
					<textarea
						ref={textareaRef}
						onInput={handleInput}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (isValid) handleSubmit();
							}
						}}
						placeholder="写下你的问题..."
						rows={3}
						className="w-full bg-background border border-border rounded-lg px-4 py-3 text-2xl font-medium text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none transition-colors duration-200"
					/>
				</div>

				{/* Action buttons */}
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={onOpenBank}
						className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground border border-input bg-background hover:bg-muted rounded-md transition-colors"
					>
						<BookOpen size={16} strokeWidth={1.5} />
						灵感题库
					</button>

					<button
						onClick={handleSubmit}
						disabled={!isValid}
						className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
							isValid
								? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
								: "bg-muted text-muted-foreground cursor-not-allowed disabled:opacity-50 disabled:cursor-not-allowed"
						}`}
					>
						<Play size={18} strokeWidth={1.5} />
						开始计时
					</button>
				</div>
			</motion.div>
		</div>
	);
}
