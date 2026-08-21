"use client";

import { Check, ChevronLeft, ChevronRight, Edit2, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Question } from "@/lib/store/breakdown-store";
import { cn } from "@/lib/utils";

interface BreakdownQuestionnaireModalProps {
	questions: Question[];
	answers: Record<string, string[]>;
	onAnswerChange: (questionId: string, options: string[]) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
	onClose: () => void;
}

export function BreakdownQuestionnaireModal({
	questions,
	answers,
	onAnswerChange,
	onSubmit,
	isSubmitting,
	onClose,
}: BreakdownQuestionnaireModalProps) {
	const t = useTranslations("chat");
	const [currentIndex, setCurrentIndex] = useState(0);
	const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
		{},
	);

	const SKIP_OPTION = "不知道/不重要";
	const CUSTOM_PREFIX = "custom:";

	const currentQuestion = questions[currentIndex];
	const isFirst = currentIndex === 0;
	const isLast = currentIndex === questions.length - 1;
	const totalQuestions = questions.length;

	const handleOptionToggle = (questionId: string, option: string) => {
		const currentAnswers = answers[questionId] || [];
		const question = questions.find((q) => q.id === questionId);
		if (!question) return;

		if (option === SKIP_OPTION) {
			if (currentAnswers.includes(SKIP_OPTION)) {
				onAnswerChange(questionId, []);
			} else {
				onAnswerChange(questionId, [SKIP_OPTION]);
				setCustomAnswers((prev) => {
					const next = { ...prev };
					delete next[questionId];
					return next;
				});
			}
			return;
		}

		const hasSkipOption = currentAnswers.includes(SKIP_OPTION);
		const hasCustomAnswer = customAnswers[questionId];
		const filteredAnswers = hasSkipOption
			? currentAnswers.filter((a) => a !== SKIP_OPTION)
			: currentAnswers;

		if (hasCustomAnswer) {
			setCustomAnswers((prev) => {
				const next = { ...prev };
				delete next[questionId];
				return next;
			});
		}

		if (filteredAnswers.includes(option)) {
			onAnswerChange(
				questionId,
				filteredAnswers.filter((a) => a !== option),
			);
		} else {
			onAnswerChange(questionId, [...filteredAnswers, option]);
		}
	};

	const handleCustomAnswerChange = (questionId: string, value: string) => {
		setCustomAnswers((prev) => ({
			...prev,
			[questionId]: value,
		}));
		if (value.trim().length > 0) {
			onAnswerChange(questionId, []);
		}
	};

	const handleCustomAnswerSubmit = (questionId: string) => {
		const customAnswer = customAnswers[questionId]?.trim();
		if (customAnswer && customAnswer.length > 0) {
			onAnswerChange(questionId, [`${CUSTOM_PREFIX}${customAnswer}`]);
		}
	};

	const hasCustomAnswer = (questionId: string): boolean => {
		const answer = answers[questionId] || [];
		return answer.some((a) => a.startsWith(CUSTOM_PREFIX));
	};

	const getCustomAnswerText = (questionId: string): string => {
		const answer = answers[questionId] || [];
		const customAnswer = answer.find((a) => a.startsWith(CUSTOM_PREFIX));
		if (customAnswer) {
			return customAnswer.substring(CUSTOM_PREFIX.length);
		}
		return customAnswers[questionId] || "";
	};

	const isSelected = (questionId: string, option: string): boolean => {
		return (answers[questionId] || []).includes(option);
	};

	const goToNext = () => {
		if (!isLast) {
			setCurrentIndex((prev) => prev + 1);
		}
	};

	const handleNext = () => {
		if (isLast) {
			onSubmit();
		} else {
			goToNext();
		}
	};

	const handleSkip = () => {
		if (isLast) {
			onSubmit();
		} else {
			goToNext();
		}
	};

	const handlePrev = () => {
		if (!isFirst) {
			setCurrentIndex((prev) => prev - 1);
		}
	};

	if (!currentQuestion) return null;

	return (
		<div className="w-full">
			{/* ── Question card ── */}
			<div className="relative rounded-lg border border-border/40 bg-background shadow-sm">
				{/* 关闭按钮 */}
				<button
					type="button"
					onClick={onClose}
					disabled={isSubmitting}
					aria-label={t("closeQuestionnaire")}
					className={cn(
						"absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
						isSubmitting && "cursor-not-allowed opacity-50",
					)}
				>
					<X className="h-4 w-4" />
				</button>

				<div className="p-5">
					{/* Question header */}
					<div className="mb-4 pr-8">
						<div className="flex items-center gap-2">
							<span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
								{currentIndex + 1}/{totalQuestions}
							</span>
							<h4 className="text-base font-medium">
								{currentQuestion.question}
							</h4>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{t("multipleChoice")}
						</p>
					</div>

					{/* Options */}
					<div className="space-y-2">
						{currentQuestion.options.map((option) => {
							const selected = isSelected(currentQuestion.id, option);
							const isSkipOption = option === SKIP_OPTION;
							return (
								<button
									key={option}
									type="button"
									onClick={() =>
										!isSubmitting &&
										handleOptionToggle(currentQuestion.id, option)
									}
									disabled={isSubmitting}
									className={cn(
										"flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors",
										selected
											? "border-primary bg-primary/10 text-foreground"
											: "border-transparent bg-muted hover:bg-muted/70",
										isSubmitting && "cursor-not-allowed opacity-50",
										isSkipOption && "border-dashed border-border",
									)}
								>
									<div
										className={cn(
											"flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 bg-background",
											selected
												? "border-primary bg-primary"
												: "border-muted-foreground/50",
										)}
									>
										{selected && (
											<Check className="h-3 w-3 text-primary-foreground" />
										)}
									</div>
									<span
										className={cn(
											"flex-1 text-sm",
											isSkipOption && "italic text-muted-foreground",
										)}
									>
										{option}
									</span>
								</button>
							);
						})}

						{/* 自定义答案输入框：默认直接显示，白底无边框 */}
						<div className="flex items-center gap-3 rounded-md border border-transparent bg-background p-3 shadow-sm ring-1 ring-border/50">
							<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-muted-foreground/50 bg-background">
								{hasCustomAnswer(currentQuestion.id) && (
									<Edit2 className="h-3 w-3 text-primary" />
								)}
							</div>
							<input
								type="text"
								value={getCustomAnswerText(currentQuestion.id)}
								onChange={(e) =>
									handleCustomAnswerChange(
										currentQuestion.id,
										e.target.value,
									)
								}
								onBlur={() => {
									const customAnswer =
										customAnswers[currentQuestion.id]?.trim();
									if (customAnswer && customAnswer.length > 0) {
										handleCustomAnswerSubmit(currentQuestion.id);
									}
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										const customAnswer =
											customAnswers[currentQuestion.id]?.trim();
										if (customAnswer && customAnswer.length > 0) {
											handleCustomAnswerSubmit(currentQuestion.id);
										}
									}
								}}
								placeholder={t("customAnswerPlaceholder")}
								disabled={isSubmitting}
								className={cn(
									"flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none",
									isSubmitting && "cursor-not-allowed opacity-50",
								)}
							/>
						</div>
					</div>
				</div>

				{/* ── Navigation bar：上一题/跳过/下一题统一在右 ── */}
				<div className="flex items-center justify-end gap-2 px-5 py-3">
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={handlePrev}
							disabled={isFirst || isSubmitting}
							className={cn(
								"flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
								isFirst || isSubmitting
									? "cursor-not-allowed text-muted-foreground/40"
									: "text-muted-foreground hover:bg-muted",
							)}
						>
							<ChevronLeft className="h-4 w-4" />
							{t("previous")}
						</button>

						<button
							type="button"
							onClick={handleSkip}
							disabled={isSubmitting}
							className={cn(
								"rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted",
								isSubmitting && "cursor-not-allowed opacity-50",
							)}
						>
							{t("skipQuestion")}
						</button>

						<button
							type="button"
							onClick={handleNext}
							disabled={isSubmitting}
							className={cn(
								"flex items-center gap-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
								isLast
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "bg-primary/10 text-primary hover:bg-primary/20",
								isSubmitting && "cursor-not-allowed opacity-50",
							)}
						>
							{isSubmitting ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									{t("submitting")}
								</>
							) : isLast ? (
								<>
									{t("submitAnswer")}
									<ChevronRight className="h-4 w-4" />
								</>
							) : (
								<>
									{t("nextQuestion")}
									<ChevronRight className="h-4 w-4" />
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
