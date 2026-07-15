"use client";

import { useCallback, useState } from "react";
import { MAX_QUESTIONS_PER_DAY } from "../constants";
import type { ZeroThinkCard, ZeroThinkPhase } from "../types";

interface UseZeroThinkSessionReturn {
	cards: ZeroThinkCard[];
	currentCard: ZeroThinkCard | null;
	phase: ZeroThinkPhase;
	todayCount: number;
	startNewQuestion: () => void;
	submitQuestion: (question: string) => void;
	submitAnswers: (answers: string[]) => void;
	lockCurrentCard: () => void;
	isDayComplete: () => boolean;
}

export function useZeroThinkSession(): UseZeroThinkSessionReturn {
	const [cards, setCards] = useState<ZeroThinkCard[]>([]);
	const [currentCard, setCurrentCard] = useState<ZeroThinkCard | null>(null);
	const [phase, setPhase] = useState<ZeroThinkPhase>("question");

	const todayCount = cards.length;

	const startNewQuestion = useCallback(() => {
		if (todayCount >= MAX_QUESTIONS_PER_DAY) {
			setPhase("completed");
			return;
		}

		const now = new Date();
		const newCard: ZeroThinkCard = {
			id: `zst_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
			userId: "",
			date: now.toISOString().split("T")[0],
			question: "",
			answers: [],
			dayIndex: todayCount + 1,
			mode: "scattered",
			durationMs: 0,
			isLocked: false,
			category: "",
			createdAt: now.toISOString(),
		};

		setCurrentCard(newCard);
		setPhase("question");
	}, [todayCount]);

	const submitQuestion = useCallback(
		(question: string) => {
			// Guard: question must contain ？ or ?
			if (!question.includes("？") && !question.includes("?")) {
				return;
			}

			setCurrentCard((prev) => {
				if (!prev) return null;
				return { ...prev, question };
			});
			setPhase("answering");
		},
		[],
	);

	const submitAnswers = useCallback(
		(answers: string[]) => {
			// Guard: must have 4-6 answers
			if (answers.length < 4 || answers.length > 6) {
				return;
			}

			// Guard: no empty answers
			const trimmed = answers.map((a) => a.trim()).filter((a) => a.length > 0);
			if (trimmed.length < 4) {
				return;
			}

			setCurrentCard((prev) => {
				if (!prev) return null;

				const completedCard: ZeroThinkCard = {
					...prev,
					answers: trimmed,
					durationMs: Date.now() - new Date(prev.createdAt).getTime(),
				};

				setCards((prevCards) => [...prevCards, completedCard]);
				return null;
			});

			setPhase("completed");
		},
		[],
	);

	const lockCurrentCard = useCallback(() => {
		setCurrentCard((prev) => {
			if (!prev) return null;
			return { ...prev, isLocked: true };
		});
		setPhase("locked");
	}, []);

	const isDayComplete = useCallback(() => {
		return todayCount >= MAX_QUESTIONS_PER_DAY;
	}, [todayCount]);

	return {
		cards,
		currentCard,
		phase,
		todayCount,
		startNewQuestion,
		submitQuestion,
		submitAnswers,
		lockCurrentCard,
		isDayComplete,
	};
}
