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
	/** 卡片「添加到对话」直接触发默认洞察：待处理的笔记，由 DiaryChatPanel 消费后清空 */
	pendingInsight: LinkedNote | null;
	addLinkedNote: (note: LinkedNote) => void;
	removeLinkedNote: (noteId: number) => void;
	clearLinkedNotes: () => void;
	triggerInsight: (note: LinkedNote) => void;
	clearPendingInsight: () => void;
}

export const useNoteChatStore = create<NoteChatState>((set) => ({
	linkedNotes: [],
	pendingInsight: null,
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
	triggerInsight: (note) => set({ pendingInsight: note }),
	clearPendingInsight: () => set({ pendingInsight: null }),
}));
