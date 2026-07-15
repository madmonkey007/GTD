"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Clock, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { useZeroThinkStore } from "@/lib/store/zero-think-store/store";
import { InspirationBank } from "./components/InspirationBank";
import { LockedCard } from "./components/LockedCard";
import { ModeSelector } from "./components/ModeSelector";
import { QuestionInput } from "./components/QuestionInput";
import { useZeroThinkSession } from "./hooks/useZeroThinkSession";
import { ZeroThinkProgress } from "./ZeroThinkProgress";
import { ZeroThinkQuestionCard } from "./ZeroThinkQuestionCard";
import { useJournalMutations } from "@/lib/query/journals";
import { MAX_QUESTIONS_PER_DAY } from "./constants";

interface ZeroThinkPanelProps {
	setActiveView?: (view: string) => void;
}

export function ZeroThinkPanel({ setActiveView }: ZeroThinkPanelProps) {
	const { mode, setMode, hasCompletedOnboarding, completeOnboarding } =
		useZeroThinkStore();
	const {
		cards,
		currentCard,
		todayCount,
		startNewQuestion,
		submitQuestion,
		submitAnswers,
		isDayComplete,
	} = useZeroThinkSession();

	const { createJournal } = useJournalMutations();

	const [showBank, setShowBank] = useState(false);
	const [localPhase, setLocalPhase] = useState<
		"idle" | "question" | "answering" | "completed"
	>("idle");
	const [activeQuestion, setActiveQuestion] = useState("");

	// Check day completion on mount
	useEffect(() => {
		const loadTodayCards = async () => {
			try {
				const res = await fetch(
					`/api/zero-think/cards?date=${new Date().toISOString().split("T")[0]}`,
				);
				if (res.ok) {
					const data = await res.json();
					if (data.length >= MAX_QUESTIONS_PER_DAY) {
						setLocalPhase("completed");
					}
				}
			} catch {
				// API may not be available, check locally
				if (isDayComplete()) {
					setLocalPhase("completed");
				}
			}
		};
		loadTodayCards();
	}, [isDayComplete]);

	const handleStartNewQuestion = () => {
		startNewQuestion();
		setLocalPhase("question");
	};

	const handleSubmitQuestion = (question: string) => {
		setActiveQuestion(question);
		submitQuestion(question);
		setLocalPhase("answering");
	};

	const handleSubmitAnswers = async (answers: string[]) => {
		submitAnswers(answers);

		// Save Q&A to journal (fire-and-forget, don't block UI)
		try {
			const questionText = activeQuestion || currentCard?.question || "";
			const answersMarkdown = answers
				.filter((a) => a.trim().length > 0)
				.map((a, i) => `${i + 1}. ${a}`)
				.join('\n');

			if (questionText && answersMarkdown) {
				const now = new Date();
				const markdownContent = `## 零秒思考\n\n**${questionText}**\n\n${answersMarkdown}`;

				createJournal({
					name: `零秒思考 - ${questionText.slice(0, 30)}`,
					user_notes: markdownContent,
					date: now.toISOString().split('T')[0] + 'T00:00:00',
					content_format: 'markdown',
					tags: ['零秒思考'],
				});
			}
		} catch (err) {
			console.error('[ZeroThink] Failed to save to journal:', err);
		}

		if (todayCount + 1 >= MAX_QUESTIONS_PER_DAY) {
			setLocalPhase("completed");
		} else {
			setLocalPhase("idle");
		}
	};

	const handleSelectFromBank = (question: string) => {
		setActiveQuestion(question);
		submitQuestion(question);
		setLocalPhase("answering");
	};

	const handleBack = () => {
		if (setActiveView) {
			setActiveView("list");
		}
	};

	return (
		<>
			<style>{`
				@keyframes fadeUp {
					from { opacity: 0; transform: translateY(8px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes shimmer {
					0% { background-position: -200% 0; }
					100% { background-position: 200% 0; }
				}
				@keyframes pulse-slow {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.7; }
				}
			`}</style>

			<div className="min-h-screen bg-background">
				{/* Top bar */}
				<div className="sticky top-0 z-40 bg-background border-b border-border">
					<div className="flex items-center justify-between px-6 py-4">
						{localPhase !== "idle" && (
							<button
								type="button"
								onClick={handleBack}
								className="p-2 text-muted-foreground hover:text-foreground transition-colors"
							>
								<ArrowLeft size={20} strokeWidth={1.5} />
							</button>
						)}

						<h1 className="text-sm font-semibold tracking-tight text-foreground">
							零秒思考
						</h1>

						<div className="flex items-center gap-2">
							<div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full border border-border">
								<Flame size={14} strokeWidth={1.5} className="text-primary" />
								<span className="text-xs font-medium text-foreground tabular-nums">
									{todayCount}
								</span>
							</div>
						</div>
					</div>

					{/* Progress bar */}
					<div className="px-6 pb-4">
						<ZeroThinkProgress completed={todayCount} />
					</div>
				</div>

			{/* Main content */}
			<div className="p-6">
				<div className="max-w-2xl mx-auto">
						{/* Idle phase - Welcome/Start screen */}
						{localPhase === "idle" && (
							<div className="min-h-[60vh] animate-[fadeUp_0.4s_ease-out_forwards]">
								{!hasCompletedOnboarding ? (
									/* Onboarding - Left aligned */
									<div className="max-w-md">
										<motion.div
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
											style={{ animationDelay: "0ms" }}
											className="mb-8"
										>
											<div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
												<Clock size={24} strokeWidth={1.5} className="text-primary" />
											</div>

											<h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
												欢迎来到零秒思考
											</h2>
											<p className="text-sm text-muted-foreground leading-relaxed">
												每天用一分钟回答一个问题，写下4-6个答案。
												训练快速思考和表达能力。
											</p>
										</motion.div>

										<motion.div
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
										>
											<ModeSelector
												selectedMode={mode}
												onSelectMode={setMode}
											/>
										</motion.div>

										<motion.button
											onClick={() => {
												completeOnboarding();
												handleStartNewQuestion();
											}}
											className="mt-8 w-full px-6 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all duration-200"
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
										>
											开始今日训练
										</motion.button>
									</div>
								) : (
									/* Day complete or ready to start - Left aligned */
									<div className="max-w-md">
										{isDayComplete() ? (
											/* Day complete */
											<motion.div
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
											>
												<div className="w-12 h-12 bg-emerald-400/10 rounded-xl flex items-center justify-center mb-4">
													<CheckCircle size={24} strokeWidth={1.5} className="text-emerald-400" />
												</div>

												<h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
													今日训练完成
												</h2>
												<p className="text-sm text-muted-foreground leading-relaxed mb-8">
													你已经完成了今天的10个问题。
													明天继续加油。
												</p>

												<button
													type="button"
													onClick={handleBack}
													className="px-6 py-2 text-sm font-medium text-foreground border border-input bg-background hover:bg-muted rounded-md transition-all duration-200"
												>
													返回列表
												</button>
											</motion.div>
										) : (
											/* Ready to start */
											<motion.div
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
											>
											<div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
												<Flame size={24} strokeWidth={1.5} className="text-primary" />
												</div>

												<h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
													继续今日训练
												</h2>
												<p className="text-sm text-muted-foreground leading-relaxed mb-8">
													今天还剩 {10 - todayCount} 个问题。
												</p>

												<div className="flex gap-3">
													<motion.button
														onClick={handleStartNewQuestion}
														className="px-6 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all duration-200"
														whileHover={{ scale: 1.01 }}
														whileTap={{ scale: 0.97 }}
													>
														开始下一个
													</motion.button>

													<button
														type="button"
														onClick={handleBack}
												className="px-6 py-2 text-sm font-medium text-foreground border border-input bg-background hover:bg-muted rounded-md transition-all duration-200"
													>
														稍后再说
													</button>
												</div>
											</motion.div>
										)}
									</div>
								)}
							</div>
						)}

						{/* Question phase */}
						{localPhase === "question" && (
							<div className="animate-[fadeUp_0.4s_ease-out_forwards]">
								<QuestionInput
									onSubmit={handleSubmitQuestion}
									onOpenBank={() => setShowBank(true)}
								/>
							</div>
						)}

						{/* Answering phase */}
						{localPhase === "answering" && (
							<div className="animate-[fadeUp_0.4s_ease-out_forwards]">
							<ZeroThinkQuestionCard
								question={activeQuestion || currentCard?.question || ""}
								onSubmit={handleSubmitAnswers}
								onOpenBank={() => setShowBank(true)}
							/>
							</div>
						)}

						{/* Completed phase */}
						{localPhase === "completed" && (
							<div className="min-h-[60vh] animate-[fadeUp_0.4s_ease-out_forwards]">
								{isDayComplete() ? (
									/* Day complete celebration - asymmetric */
									<div className="max-w-md">
										<motion.div
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
										>
											<div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
												<CheckCircle size={24} strokeWidth={1.5} className="text-primary" />
											</div>

											<h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
												今日训练完成
											</h2>
											<p className="text-sm text-muted-foreground leading-relaxed mb-8">
												你已经完成了今天的10个问题。
												坚持就是胜利。
											</p>

											<button
												type="button"
												onClick={handleBack}
												className="px-6 py-2 text-sm font-medium text-foreground border border-input bg-background hover:bg-muted rounded-md transition-all duration-200"
											>
												返回列表
											</button>
										</motion.div>
									</div>
								) : (
									/* Single question complete */
									<div className="max-w-md">
										<motion.div
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
										>
											<div className="w-12 h-12 bg-emerald-400/10 rounded-xl flex items-center justify-center mb-4">
												<CheckCircle size={24} strokeWidth={1.5} className="text-emerald-400" />
											</div>

											<h2 className="text-xl font-semibold tracking-tight text-foreground mb-2">
												回答已提交
											</h2>
										</motion.div>

										{/* Show locked cards */}
										<div className="gap-3 mb-8 max-h-[40vh] overflow-y-auto mt-6">
											{cards.map((card, index) => (
												<div
													key={card.id}
													style={{ animationDelay: `${index * 60}ms` }}
													className="animate-[fadeUp_0.4s_ease-out_forwards] opacity-0"
												>
													<LockedCard card={card} />
												</div>
											))}
										</div>

										<div className="flex gap-3">
											<motion.button
												onClick={handleStartNewQuestion}
												className="px-6 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all duration-200"
												whileHover={{ scale: 1.01 }}
												whileTap={{ scale: 0.97 }}
											>
												下一个问题
											</motion.button>

											<button
												type="button"
												onClick={handleBack}
												className="px-6 py-2 text-sm font-medium text-foreground border border-input bg-background hover:bg-muted rounded-md transition-all duration-200"
											>
												稍后再说
											</button>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Inspiration bank drawer */}
				<InspirationBank
					isOpen={showBank}
					onClose={() => setShowBank(false)}
					onSelect={handleSelectFromBank}
				/>
			</div>
		</>
	);
}
