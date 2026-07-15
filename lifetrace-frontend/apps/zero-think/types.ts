export interface ZeroThinkCard {
	id: string;
	userId: string;
	date: string; // YYYY-MM-DD
	question: string; // Must contain ？ or ?
	answers: string[]; // 4-6 answers
	dayIndex: number; // 1-10 (which question today)
	mode: "scattered" | "batch";
	durationMs: number; // Actual time spent
	isLocked: boolean;
	category: string;
	createdAt: string;
}

export interface ZeroThinkSession {
	date: string;
	cards: ZeroThinkCard[];
	mode: "scattered" | "batch";
	isCompleted: boolean; // Whether all 10 done today
}

export interface ZeroThinkStats {
	totalDays: number;
	currentStreak: number;
	bestStreak: number;
	todayCount: number;
	todayCompleted: boolean;
}

export type ZeroThinkPhase = "question" | "answering" | "locked" | "completed";
