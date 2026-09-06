export interface JournalTitleCandidate {
	id: number;
	name: string;
	userNotes: string;
}

const AUTO_TITLE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export function isPseudoJournalTitle(name: string | null | undefined): boolean {
	const normalized = (name ?? "").trim();
	return normalized === "" || normalized === "Untitled" || AUTO_TITLE_PATTERN.test(normalized);
}

export function shouldGenerateJournalTitle(candidate: JournalTitleCandidate): boolean {
	return (
		candidate.id > 0 &&
		candidate.userNotes.trim().length > 0 &&
		isPseudoJournalTitle(candidate.name)
	);
}

export function applyGeneratedTitleToDraft<
	T extends { id: number | null; name: string },
>(draft: T, generated: { id: number; name: string }): T {
	if (draft.id !== generated.id || !isPseudoJournalTitle(draft.name)) return draft;
	return { ...draft, name: generated.name };
}

export function applyJournalUpdateToList<T extends { id: number }>(
	journals: T[],
	updated: T,
): T[] {
	const index = journals.findIndex((journal) => journal.id === updated.id);
	if (index < 0) return journals;
	const next = [...journals];
	next[index] = updated;
	return next;
}

export function createJournalTitleRequestGate() {
	const inFlight = new Set<number>();
	return {
		run<T>(journalId: number, request: () => Promise<T>): Promise<T> | undefined {
			if (inFlight.has(journalId)) return undefined;
			inFlight.add(journalId);
			return (async () => {
				try {
					return await request();
				} finally {
					inFlight.delete(journalId);
				}
			})();
		},
	};
}
