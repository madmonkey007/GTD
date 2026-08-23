import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 收集箱草稿：agent 面板输入框中"不触发 agent"的随手记录。
 * 仅存本地（localStorage），不上服务端；超过失效时间（默认 24 小时，可在设置中调整）
 * 的草稿在读取/新增时自动清理。后续可转为正式待办/笔记或交给 agent 处理。
 */
export interface InboxDraft {
	id: string;
	text: string;
	createdAt: string;
}

const DEFAULT_EXPIRY_HOURS = 24;

interface InboxDraftState {
	drafts: InboxDraft[];
	/** 草稿失效时间（小时），设置页可改 */
	expiryHours: number;
	addDraft: (text: string) => void;
	removeDraft: (id: string) => void;
	clearDrafts: () => void;
	setExpiryHours: (hours: number) => void;
	/** 清理已过期的草稿（读取前调用） */
	pruneExpired: () => void;
}

const newId = () =>
	typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isExpired = (d: InboxDraft, expiryHours: number) =>
	Date.now() - Date.parse(d.createdAt) > expiryHours * 3600 * 1000;

const prune = (drafts: InboxDraft[], expiryHours: number) =>
	drafts.filter((d) => !isExpired(d, expiryHours));

export const useInboxDraftStore = create<InboxDraftState>()(
	persist(
		(set, get) => ({
			drafts: [],
			expiryHours: DEFAULT_EXPIRY_HOURS,
			addDraft: (text) =>
				set((s) => ({
					// 新增时顺带清理过期草稿
					drafts: [
						{ id: newId(), text: text.trim(), createdAt: new Date().toISOString() },
						...prune(s.drafts, s.expiryHours),
					],
				})),
			removeDraft: (id) => set((s) => ({ drafts: s.drafts.filter((d) => d.id !== id) })),
			clearDrafts: () => set({ drafts: [] }),
			setExpiryHours: (hours) =>
				set({ expiryHours: Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_EXPIRY_HOURS }),
			pruneExpired: () => {
				const { drafts, expiryHours } = get();
				const next = prune(drafts, expiryHours);
				if (next.length !== drafts.length) set({ drafts: next });
			},
		}),
		{ name: "inbox-drafts" },
	),
);
