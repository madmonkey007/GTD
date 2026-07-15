"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MAX_ANSWERS, MIN_ANSWERS } from "../constants";

interface AnswerInputProps {
	initialAnswers?: string[];
	onChange: (answers: string[]) => void;
	disabled?: boolean;
}

export function AnswerInput({
	initialAnswers = [],
	onChange,
	disabled = false,
}: AnswerInputProps) {
	const [answers, setAnswers] = useState<string[]>(() => {
		// Initialize with at least MIN_ANSWERS lines
		const initial = [...initialAnswers];
		while (initial.length < MIN_ANSWERS) {
			initial.push("");
		}
		return initial;
	});

	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		onChange(answers);
	}, [answers, onChange]);

	const handleChange = (index: number, value: string) => {
		const newAnswers = [...answers];
		newAnswers[index] = value;
		setAnswers(newAnswers);
	};

	const handleKeyDown = (
		index: number,
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (e.key === "Enter") {
			e.preventDefault();
			// Focus next input if exists
			if (index < answers.length - 1) {
				inputRefs.current[index + 1]?.focus();
			}
		}
	};

	const addLine = () => {
		if (answers.length < MAX_ANSWERS) {
			setAnswers([...answers, ""]);
			// Focus the new input after render
			setTimeout(() => {
				inputRefs.current[answers.length]?.focus();
			}, 0);
		}
	};

	const removeLine = (index: number) => {
		if (answers.length > MIN_ANSWERS) {
			const newAnswers = answers.filter((_, i) => i !== index);
			setAnswers(newAnswers);
		}
	};

	const filledCount = answers.filter((a) => a.trim().length > 0).length;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-medium text-foreground">
					写下你的答案
				</h3>
				<span className="text-xs text-muted-foreground tabular-nums">
					{filledCount}/{MIN_ANSWERS} 最少
				</span>
			</div>

			<div className="space-y-2">
				<AnimatePresence>
					{answers.map((answer, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="flex items-center gap-2"
						>
							<span className="font-mono text-xs text-muted-foreground w-6">
								{index + 1}.
							</span>
							<input
								ref={(el) => {
									inputRefs.current[index] = el;
								}}
								type="text"
								value={answer}
								onChange={(e) =>
									handleChange(index, e.target.value)
								}
								onKeyDown={(e) => handleKeyDown(index, e)}
								placeholder={`答案 ${index + 1}`}
								disabled={disabled}
								className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors duration-200"
							/>
							{answers.length > MIN_ANSWERS && (
								<button
									type="button"
									onClick={() => removeLine(index)}
									disabled={disabled}
									className="p-2 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
								>
									<X size={14} strokeWidth={1.5} />
								</button>
							)}
						</motion.div>
					))}
				</AnimatePresence>
			</div>

			{answers.length < MAX_ANSWERS && (
				<motion.button
					onClick={addLine}
					disabled={disabled}
					className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-border/80 rounded-xl transition-all duration-200"
					whileHover={{ scale: 1.01 }}
					whileTap={{ scale: 0.97 }}
				>
					<Plus size={14} strokeWidth={1.5} />
					添加一行
				</motion.button>
			)}
		</div>
	);
}
