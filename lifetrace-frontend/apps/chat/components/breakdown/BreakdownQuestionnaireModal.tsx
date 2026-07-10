"use client";

import { Check, ChevronLeft, ChevronRight, Edit2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Question } from "@/lib/store/breakdown-store";
import { cn } from "@/lib/utils";

interface BreakdownQuestionnaireModalProps {
	questions: Question[];
	answers: Record<string, string[]>;
	onAnswerChange: (questionId: string, options: string[]) => void;
	onSubmit: () => void;
	isSubmitting: boolean;
}

export function BreakdownQuestionnaireModal({
	questions,
	answers,
	onAnswerChange,
	onSubmit,
	isSubmitting,
}: BreakdownQuestionnaireModalProps) {
	const t = useTranslations("chat");
	const [currentIndex, setCurrentIndex] = useState(0);
	const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
		{},
	);
	const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
		null,
	);

	const SKIP_OPTION = "不知道/不重要";
	const CUSTOM_PREFIX = "custom:";

	const currentQuestion = questions[currentIndex];
	const isFirst = currentIndex === 0;
	const isLast = currentIndex === questions.length - 1;
	const totalQuestions = questions.length;

	// 计算已回答的问题数量
	const answeredCount = useMemo(() => {
		return questions.filter((q) => {
			const answer = answers[q.id];
			const customAnswer = customAnswers[q.id];
			return (
				(answer && answer.length > 0) ||
				(customAnswer && customAnswer.trim().length > 0)
			);
		}).length;
	}, [questions, answers, customAnswers]);

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
				setEditingQuestionId(null);
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
			setEditingQuestionId(null);
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
			setEditingQuestionId(null);
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

	const handleNext = () => {
		if (isLast) {
			onSubmit();
		} else {
			setCurrentIndex((prev) => prev + 1);
		}
	};

	const handlePrev = () => {
		if (!isFirst) {
			setCurrentIndex((prev) => prev - 1);
		}
	};

	if (!currentQuestion) return null;

	return (
		<div className="mx-auto w-full max-w-2xl px-4 pb-2">
			{/* ── Tab progress dots + counter ── */}
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					{questions.map((_, i) => (
						<button
							key={i}
							type="button"
							onClick={() => setCurrentIndex(i)}
							aria-label={t("goToQuestion", { index: i + 1 })}
							className={cn(
								"h-2 rounded-full transition-all",
								i === currentIndex
									? "w-6 bg-primary"
									: i < answeredCount
										? "w-2 bg-primary/50"
										: "w-2 bg-muted-foreground/30",
							)}
						/>
					))}
				</div>
				<span className="text-xs text-muted-foreground">
					{currentIndex + 1}/{totalQuestions}
				</span>
			</div>

			{/* ── Question card ── */}
			<div className="rounded-xl border bg-card shadow-lg">
				<div className="p-5">
					{/* Question header */}
					<div className="mb-4">
						<div className="flex items-center gap-2">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
								{currentIndex + 1}
							</span>
							<h4 className="text-base font-medium">
								{currentQuestion.question}
							</h4>
						</div>
						<p className="ml-8 mt-1 text-xs text-muted-foreground">
							{t("multipleChoice")}
						</p>
					</div>

					{/* Options */}
					<div className="ml-8 space-y-2">
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
											: "border-border bg-background hover:bg-muted",
										isSubmitting && "cursor-not-allowed opacity-50",
										isSkipOption && "border-dashed",
									)}
								>
									<div
										className={cn(
											"flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2",
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

						{/* Custom answer / Skip row */}
						{editingQuestionId === currentQuestion.id ? (
							<div className="flex items-center gap-2 rounded-md border border-dashed border-primary bg-primary/5 p-3">
								<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-primary bg-primary">
									<Edit2 className="h-3 w-3 text-primary-foreground" />
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
										} else {
											setEditingQuestionId(null);
											if (!hasCustomAnswer(currentQuestion.id)) {
												setCustomAnswers((prev) => {
													const next = { ...prev };
													delete next[currentQuestion.id];
													return next;
												});
											}
										}
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											const customAnswer =
												customAnswers[currentQuestion.id]?.trim();
											if (customAnswer && customAnswer.length > 0) {
												handleCustomAnswerSubmit(currentQuestion.id);
											} else {
												setEditingQuestionId(null);
											}
										}
										if (e.key === "Escape") {
											setEditingQuestionId(null);
											if (!hasCustomAnswer(currentQuestion.id)) {
												setCustomAnswers((prev) => {
													const next = { ...prev };
													delete next[currentQuestion.id];
													return next;
												});
											}
										}
									}}
									placeholder={t("customAnswerPlaceholder")}
									disabled={isSubmitting}
									// biome-ignore lint/a11y/noAutofocus: 自定义输入框需要自动聚焦以提升用户体验
									autoFocus
									className={cn(
										"flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none",
										isSubmitting && "cursor-not-allowed opacity-50",
									)}
								/>
							</div>
						) : (
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() =>
										!isSubmitting &&
										handleOptionToggle(currentQuestion.id, SKIP_OPTION)
									}
									disabled={isSubmitting}
									className={cn(
										"flex flex-1 items-center gap-3 rounded-md border border-dashed p-3 text-left transition-colors",
										isSelected(currentQuestion.id, SKIP_OPTION)
											? "border-primary bg-primary/10 text-foreground"
											: "border-muted-foreground/50 bg-background hover:bg-muted",
										isSubmitting && "cursor-not-allowed opacity-50",
										hasCustomAnswer(currentQuestion.id) &&
											"border-primary/50",
									)}
								>
									<div
										className={cn(
											"flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2",
											isSelected(currentQuestion.id, SKIP_OPTION)
												? "border-primary bg-primary"
												: hasCustomAnswer(currentQuestion.id)
													? "border-primary/50 bg-primary/5"
													: "border-muted-foreground/50",
										)}
									>
										{isSelected(currentQuestion.id, SKIP_OPTION) && (
											<Check className="h-3 w-3 text-primary-foreground" />
										)}
										{hasCustomAnswer(currentQuestion.id) &&
											!isSelected(currentQuestion.id, SKIP_OPTION) && (
												<Edit2 className="h-3 w-3 text-primary" />
											)}
									</div>
									<span
										className={cn(
											"flex-1 text-sm",
											isSelected(currentQuestion.id, SKIP_OPTION)
												? "italic text-muted-foreground"
												: hasCustomAnswer(currentQuestion.id)
													? "text-foreground"
													: "italic text-muted-foreground",
										)}
									>
										{hasCustomAnswer(currentQuestion.id)
											? getCustomAnswerText(currentQuestion.id)
											: SKIP_OPTION}
									</span>
								</button>
								<button
									type="button"
									onClick={() => {
										if (!isSubmitting) {
											setEditingQuestionId(currentQuestion.id);
											if (
												answers[currentQuestion.id] &&
												answers[currentQuestion.id].length > 0 &&
												!hasCustomAnswer(currentQuestion.id)
											) {
												onAnswerChange(currentQuestion.id, []);
											}
											if (!customAnswers[currentQuestion.id]) {
												setCustomAnswers((prev) => ({
													...prev,
													[currentQuestion.id]: "",
												}));
											}
										}
									}}
									disabled={isSubmitting}
									className={cn(
										"flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted",
										isSubmitting && "cursor-not-allowed opacity-50",
										hasCustomAnswer(currentQuestion.id) &&
											"border-primary bg-primary/10",
									)}
									title={t("customAnswer")}
								>
									<Edit2 className="h-4 w-4 text-muted-foreground" />
								</button>
							</div>
						)}
					</div>
				</div>

				{/* ── Navigation bar ── */}
				<div className="flex items-center justify-between border-t px-5 py-3">
					<button
						type="button"
						onClick={handlePrev}
						disabled={isFirst || isSubmitting}
						className={cn(
							"flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
							isFirst
								? "cursor-not-allowed text-muted-foreground/40"
								: "text-muted-foreground hover:bg-muted",
						)}
					>
						<ChevronLeft className="h-4 w-4" />
						{t("previous")}
					</button>

					<span className="text-xs text-muted-foreground">
						{t("answeredProgress", {
							answered: answeredCount,
							total: totalQuestions,
						})}
					</span>

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
	);
}
