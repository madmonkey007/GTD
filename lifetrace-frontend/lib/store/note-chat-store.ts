import { create } from "zustand";

export interface LinkedNote {
	id: number;
	name: string;
	userNotes: string;
	date: string;
	tags: string[];
}

interface NoteChatState {
	linkedNotes: LinkedNote[];
	addLinkedNote: (note: LinkedNote) => void;
	removeLinkedNote: (noteId: number) => void;
	clearLinkedNotes: () => void;
}

export const useNoteChatStore = create<NoteChatState>((set) => ({
	linkedNotes: [],
	addLinkedNote: (note) =>
		set((state) => {
			if (state.linkedNotes.some((n) => n.id === note.id)) return state;
			return { linkedNotes: [...state.linkedNotes, note] };
		}),
	removeLinkedNote: (noteId) =>
		set((state) => ({
			linkedNotes: state.linkedNotes.filter((n) => n.id !== noteId),
		})),
	clearLinkedNotes: () => set({ linkedNotes: [] }),
}));
