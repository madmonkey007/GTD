"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { AnswerInput } from "./components/AnswerInput";
import { MIN_ANSWERS } from "./constants";
import { useZeroThinkTimer } from "./hooks/useZeroThinkTimer";
import { ZeroThinkTimer } from "./ZeroThinkTimer";

interface ZeroThinkQuestionCardProps {
	question: string;
	onSubmit: (answers: string[]) => void;
	onOpenBank: () => void;
}

export function ZeroThinkQuestionCard({
	question,
	onSubmit,
	onOpenBank,
}: ZeroThinkQuestionCardProps) {
	const [answers, setAnswers] = useState<string[]>([]);
	const {
		timeRemaining,
		isExpired,
		start,
		stop,
	} = useZeroThinkTimer();

	const filledCount = answers.filter((a) => a.trim().length > 0).length;
	const canSubmit = filledCount >= MIN_ANSWERS && !isExpired;

	// Start timer on mount
	useEffect(() => {
		start();
	}, [start]);

	const handleSubmit = () => {
		if (canSubmit) {
			stop();
			onSubmit(answers);
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
			className="w-full max-w-2xl"
		>
			{/* Question header */}
		<div className="bg-card border border-border rounded-xl p-6 mb-4">
			<div className="flex items-start justify-between">
				<div className="flex-1 mr-4 border-l-2 border-primary pl-4">
					<h2 className="text-lg font-medium text-foreground">
							{question}
						</h2>
					</div>
					<div className="flex-shrink-0 scale-90 origin-top-right">
						<ZeroThinkTimer
							timeRemaining={timeRemaining}
							isWarning={timeRemaining <= 10}
						/>
					</div>
				</div>
			</div>

			{/* Answer input */}
		<div className="bg-card border border-border rounded-xl p-6 mb-4">
			<AnswerInput onChange={setAnswers} disabled={isExpired} />
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

				<motion.button
					onClick={handleSubmit}
					disabled={!canSubmit}
					className={`px-6 py-3 rounded-md text-sm font-medium transition-all duration-200 ${
						canSubmit
							? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97]"
							: "bg-muted text-muted-foreground cursor-not-allowed disabled:opacity-50 disabled:cursor-not-allowed"
					}`}
					whileHover={canSubmit ? { scale: 1.01 } : {}}
					whileTap={canSubmit ? { scale: 0.97 } : {}}
				>
					提交
				</motion.button>
			</div>

			{/* Status indicator */}
			{isExpired && (
				<motion.div
					initial={{ opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					className="mt-4 text-center text-primary/80 text-sm"
				>
					时间已到，请提交你的答案。
				</motion.div>
			)}
		</motion.div>
	);
}
