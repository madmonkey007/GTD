"use client";

import { useCallback, useSyncExternalStore } from "react";

const TRASH_STORAGE_KEY = "diary-trash";
const TRASH_MAX_DAYS = 30;

export interface TrashEntry {
	id: number;
	name: string;
	userNotes: string;
	date: string;
	tags: { tagName: string }[];
	mood?: string | null;
	energy?: number | null;
	contentObjective?: string | null;
	contentAi?: string | null;
	deletedAt: string;
}

interface TrashStore {
	entries: TrashEntry[];
}

function getTrashStore(): TrashStore {
	try {
		const raw = localStorage.getItem(TRASH_STORAGE_KEY);
		if (raw) return JSON.parse(raw) as TrashStore;
	} catch {
		// ignore
	}
	return { entries: [] };
}

function setTrashStore(store: TrashStore): void {
	localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(store));
}

/** Purge entries older than TRASH_MAX_DAYS */
function purgeExpired(store: TrashStore): TrashStore {
	const cutoff = Date.now() - TRASH_MAX_DAYS * 24 * 60 * 60 * 1000;
	return {
		entries: store.entries.filter((e) => new Date(e.deletedAt).getTime() > cutoff),
	};
}

// --- Cached snapshot for useSyncExternalStore ---
// Must return the same array reference when data hasn't changed,
// otherwise React detects a different value on every render -> infinite loop.
let cachedSnapshot: TrashEntry[] = [];

function rebuildSnapshot(): void {
	const s = getTrashStore();
	cachedSnapshot = purgeExpired(s).entries;
}

function getTrashSnapshot(): TrashEntry[] {
	return cachedSnapshot;
}

// Initialize cache on module load
rebuildSnapshot();

/** Subscribe to storage events so the hook stays reactive across components */
const listeners = new Set<() => void>();

function subscribeToTrash(callback: () => void): () => void {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

function notifyListeners(): void {
	rebuildSnapshot();
	for (const cb of listeners) cb();
}

export function useJournalTrash() {
	const store = useSyncExternalStore(subscribeToTrash, getTrashSnapshot);

	const addToTrash = useCallback(
		(entry: Omit<TrashEntry, "deletedAt">) => {
			const store = getTrashStore();
			store.entries.unshift({
				...entry,
				deletedAt: new Date().toISOString(),
			});
			const purged = purgeExpired(store);
			setTrashStore(purged);
			notifyListeners();
		},
		[],
	);

	const removeFromTrash = useCallback((id: number) => {
		const store = getTrashStore();
		store.entries = store.entries.filter((e) => e.id !== id);
		setTrashStore(store);
		notifyListeners();
	}, []);

	const clearTrash = useCallback(() => {
		setTrashStore({ entries: [] });
		notifyListeners();
	}, []);

	const restoreFromTrash = useCallback(
		(id: number) => {
			const store = getTrashStore();
			const entry = store.entries.find((e) => e.id === id);
			if (entry) {
				store.entries = store.entries.filter((e) => e.id !== id);
				setTrashStore(store);
				notifyListeners();
			}
			return entry ?? null;
		},
		[],
	);

	return {
		trashEntries: store as TrashEntry[],
		addToTrash,
		removeFromTrash,
		clearTrash,
		restoreFromTrash,
	};
}
