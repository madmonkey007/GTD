"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
	Bold,
	Underline,
	Highlighter,
	ListOrdered,
	List,
	Hash,
	ChevronDown,
	ChevronUp,
	Clock,
	Send,
	MoreHorizontal,
	Pencil,
	Pin,
	PinOff,
	Trash2,
	GitFork,
	TriangleAlert,
	Check,
	X,
	RefreshCw,
	MessageSquarePlus,
	ArrowUpLeft,
	Search,
	MessageCircle,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useJournals } from "@/lib/query";
import type { JournalDraft } from "@/apps/diary/types";
import type { JournalView } from "@/lib/query";

import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useNoteChatStore } from "@/lib/store/note-chat-store";
import { useUiStore } from "@/lib/store/ui-store";

export type DiaryFilterMode = "all" | "last7" | "random";

function extractTagsFromContent(content: string): string[] {
	const matches = content.match(/#([^\s#]+)(\s|$)/g);
	if (!matches) return [];
	return [...new Set(matches.map((m) => m.slice(1).trimEnd()))];
}

// 笔记卡片 markdown 渲染组件：支持列表、粗体、标题等，#tag 通过 rehypeRaw 渲染 HTML 标签

function NoteMarkdown({ content }: { content: string }) {
	// 预处理：把所有 #tag 替换成 HTML <span> 标签
	// 使用 rehypeRaw 插件允许 HTML 在 markdown 中渲染
	const processedContent = content.replace(
		/#(\S+)/g,
		'<span class="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground align-middle">#$1</span>'
	);
	return (
		<div className="text-xs text-muted-foreground leading-relaxed">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeRaw]}
				components={{
					p: ({ children }: { children?: React.ReactNode }) => (
						<p className="my-0 leading-relaxed">{children}</p>
					),
					ul: ({ children }: { children?: React.ReactNode }) => (
						<ul className="my-0 list-disc pl-4 space-y-0">{children}</ul>
					),
					ol: ({ children }: { children?: React.ReactNode }) => (
						<ol className="my-0 list-decimal pl-4 space-y-0">{children}</ol>
					),
					li: ({ children }: { children?: React.ReactNode }) => (
						<li className="leading-relaxed">{children}</li>
					),
					strong: ({ children }: { children?: React.ReactNode }) => (
						<strong className="font-semibold">{children}</strong>
					),
					em: ({ children }: { children?: React.ReactNode }) => (
						<em className="italic">{children}</em>
					),
					h1: ({ children }: { children?: React.ReactNode }) => (
						<h1 className="text-xs font-bold mb-0.5">{children}</h1>
					),
					h2: ({ children }: { children?: React.ReactNode }) => (
						<h2 className="text-xs font-semibold mb-0.5">{children}</h2>
					),
					h3: ({ children }: { children?: React.ReactNode }) => (
						<h3 className="text-[11px] font-semibold mb-0.5">{children}</h3>
					),
					code: ({ children }: { children?: React.ReactNode }) => (
						<code className="px-1 py-0.5 rounded text-[11px] font-mono bg-muted/40">{children}</code>
					),
				}}
			>
				{processedContent}
			</ReactMarkdown>
		</div>
	);
}

interface DiaryEditorProps {
	draft: JournalDraft;
	filterMode: DiaryFilterMode;
	tagFilter?: string | null;
	onTitleChange: (value: string) => void;
	onUserNotesChange: (value: string) => void;
	onUserNotesBlur: (value: string) => void;
	heatmapFilterDate?: Date | null;
	onClearHeatmapFilter?: () => void;
	pinnedIds: number[];
	onDelete: (note: JournalView) => void;
	onTogglePin: (journalId: number) => void;
	onSubmit: () => void;
	onSaveCardEdit: (journalId: number, data: { name?: string | null; user_notes?: string | null }) => Promise<void>;
	onInlineTag?: (tagName: string) => void;
	similarToNoteId?: number | null;
	onSimilarClick?: (noteId: number) => void;
	onClearSimilarFilter?: () => void;
	recentTags?: string[];
	onAnnotate?: (note: JournalView) => void;
	onCompareNotes?: (sourceNote: JournalView, currentNote: JournalView) => void;
	relatedNotesData?: JournalView[];
	showLeftToggle?: boolean;
	showRightToggle?: boolean;
	isLeftOpen?: boolean;
	isRightOpen?: boolean;
	onToggleLeft?: () => void;
	onToggleRight?: () => void;
}

type FormatKey = "bold" | "underline" | "highlight" | "ol" | "ul" | "tag";

const FORMAT_ACTIONS: {
	key: FormatKey;
	icon: React.FC<{ className?: string }>;
	title: string;
}[] = [
	{ key: "bold", icon: Bold, title: "+" },
	{ key: "underline", icon: Underline, title: "_" },
	{ key: "highlight", icon: Highlighter, title: "=" },
	{ key: "ol", icon: ListOrdered, title: "1." },
	{ key: "ul", icon: List, title: "-" },
	{ key: "tag", icon: Hash, title: "#" },
];

export function DiaryEditor({
	draft,
	filterMode,
	tagFilter,
	heatmapFilterDate,
	onClearHeatmapFilter,
	onTitleChange,
	onUserNotesChange,
	onUserNotesBlur,
	pinnedIds,
	onDelete,
	onTogglePin,
	onSubmit,
	onSaveCardEdit,
	onInlineTag,
	similarToNoteId,
	onSimilarClick,
	onClearSimilarFilter,
	recentTags = [],
	onAnnotate,
	onCompareNotes,
	relatedNotesData,
	showLeftToggle = false,
	showRightToggle = false,
	isLeftOpen = false,
	isRightOpen = false,
	onToggleLeft,
	onToggleRight,
}: DiaryEditorProps) {
	const t = useTranslations("journalPanel");
	const locale = useLocale();
	const editorRef = useRef<HTMLDivElement>(null);
	const [showTagPicker, setShowTagPicker] = useState(false);
	const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
	const [deleteDialogNote, setDeleteDialogNote] = useState<JournalView | null>(null);
	const [isFocused, setIsFocused] = useState(false);
	const [editingCardId, setEditingCardId] = useState<number | null>(null);
	const [editName, setEditName] = useState("");
	const [editContent, setEditContent] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [randomShuffle, setRandomShuffle] = useState(0);
		const [searchQuery, setSearchQuery] = useState("");
		const [debouncedSearch, setDebouncedSearch] = useState("");
	const editTextareaRef = useRef<HTMLTextAreaElement>(null);
	const [cursorPos, setCursorPos] = useState<{ top: number; left: number } | null>(null);
	const cursorPosRef = useRef<{ top: number; left: number } | null>(null);
	const [tagAutocomplete, setTagAutocomplete] = useState<{
		query: string;
		open: boolean;
		selectedIndex: number;
	}>({ query: '', open: false, selectedIndex: 0 });
	const autocompleteRef = useRef<HTMLDivElement>(null);
	const tagAutocompleteVisible = tagAutocomplete.open && recentTags.length > 0;

	const filteredTags = useMemo(() => {
		if (!tagAutocomplete.open) return [];
		const q = tagAutocomplete.query.toLowerCase();
		return recentTags
			.filter(t => !q || t.toLowerCase().includes(q))
			.slice(0, 8);
	}, [recentTags, tagAutocomplete.open, tagAutocomplete.query]);

	const closeAutocomplete = useCallback(() => {
		setTagAutocomplete({ query: '', open: false, selectedIndex: 0 });
		setCursorPos(null);
	}, []);

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Close autocomplete when clicking outside
	useEffect(() => {
		if (!tagAutocompleteVisible) return;
		const handler = (e: MouseEvent) => {
			if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
				closeAutocomplete();
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [tagAutocompleteVisible, closeAutocomplete]);

		const journalQuery = useMemo(() => {
		const params: Record<string, unknown> = { limit: 50, offset: 0 };
		if (filterMode === "last7") {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
			const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
			params.startDate = start.toISOString();
			params.endDate = end.toISOString();
		} else if (heatmapFilterDate) {
			const start = new Date(heatmapFilterDate);
			start.setHours(0, 0, 0, 0);
			const end = new Date(heatmapFilterDate);
			end.setHours(23, 59, 59, 999);
			params.startDate = start.toISOString();
			params.endDate = end.toISOString();
		}
		if (debouncedSearch.trim()) {
			params.search = debouncedSearch.trim();
		}
		return params;
	}, [filterMode, heatmapFilterDate, debouncedSearch]);
	const { data: notesData, isLoading: isNotesLoading } = useJournals(journalQuery);
	const addLinkedNote = useNoteChatStore((s) => s.addLinkedNote);
	const { getFeatureByPosition, setPanelFeature } = useUiStore();
	const autoFilledRef = useRef(false);
	const inlineTagRef = useRef(onInlineTag);
	inlineTagRef.current = onInlineTag;
	const userNotesChangeRef = useRef(onUserNotesChange);
	userNotesChangeRef.current = onUserNotesChange;

	const getEditorText = useCallback(() => {
		const div = editorRef.current;
		if (!div) return '';
		return div.innerText || '';
	}, []);

	const setEditorContent = useCallback((text: string) => {
		const div = editorRef.current;
		if (!div) return;
		div.innerHTML = '';
		const fragment = document.createDocumentFragment();
		let lastIdx = 0;
		const regex = /([^#]*)(#\S+)(\s|$)/g;
		let m: RegExpExecArray | null;
		while ((m = regex.exec(text)) !== null) {
			if (m[1]) fragment.appendChild(document.createTextNode(m[1]));
			const span = document.createElement('span');
			span.className = 'inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary';
			span.contentEditable = 'false';
			span.textContent = m[2];
			fragment.appendChild(span);
			if (m[3]) fragment.appendChild(document.createTextNode(m[3]));
			lastIdx = m.index + m[0].length;
		}
		if (lastIdx < text.length) {
			fragment.appendChild(document.createTextNode(text.slice(lastIdx)));
		}
		div.appendChild(fragment);
	}, []);

	// Sync editor content with draft.userNotes when it changes externally
	useEffect(() => {
		const div = editorRef.current;
		if (!div) return;
		const currentText = div.innerText || '';
		if (currentText !== draft.userNotes && draft.userNotes !== undefined) {
			setEditorContent(draft.userNotes);
		}
	}, [draft.userNotes, setEditorContent]);

	const handleEditorInput = useCallback(() => {
		const div = editorRef.current;
		if (!div) return;

		const sel = window.getSelection();
		if (!sel?.rangeCount) { onUserNotesChange(getEditorText()); return; }

		const range = sel.getRangeAt(0);
		const node = range.startContainer;

		// Only process text nodes at cursor
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.nodeValue || '';
			const pos = range.startOffset;
			const beforeCursor = text.slice(0, pos);

			// Check if cursor is right after '#tag ' (space just typed after #tag)
			const tagMatch = beforeCursor.match(/(?:^|\s)#\S+\s$/);
			if (tagMatch) {
				const fullMatch = tagMatch[0];
				const matchStart = tagMatch.index!;
				const leadingSpace = fullMatch.startsWith(' ') ? ' ' : '';
				const tagText = fullMatch.trim();
				const afterCursor = text.slice(pos);

				const fragment = document.createDocumentFragment();
				if (matchStart > 0) fragment.appendChild(document.createTextNode(text.slice(0, matchStart)));
				if (leadingSpace) fragment.appendChild(document.createTextNode(' '));

				const span = document.createElement('span');
				span.className = 'inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary';
				span.contentEditable = 'false';
				span.textContent = tagText;
				fragment.appendChild(span);

				fragment.appendChild(document.createTextNode(' '));
				if (afterCursor) fragment.appendChild(document.createTextNode(afterCursor));

				node.parentNode!.replaceChild(fragment, node);

				const newRange = document.createRange();
				newRange.setStartAfter(span.nextSibling!);
				newRange.collapse(true);
				sel.removeAllRanges();
				sel.addRange(newRange);
			}
		}

		// Show autocomplete when typing #query (no trailing space)
		let beforeText = "";
		if (node.nodeType === Node.TEXT_NODE) {
			beforeText = (node.nodeValue || "").slice(0, range.startOffset);
		} else {
			beforeText = div.innerText || "";
		}
		const hashQueryMatch = beforeText.match(/#([^\s#]*)$/);
		if (hashQueryMatch) {
			const query = hashQueryMatch[1];
			if (sel?.rangeCount) {
				const r = sel.getRangeAt(0).getBoundingClientRect();
				const pos = { top: r.bottom + 2, left: r.left };
				cursorPosRef.current = pos;
				setCursorPos(pos);;
			}
			setTagAutocomplete(prev => {
				if (prev.open && prev.query === query && prev.selectedIndex === 0) return prev;
				return { query, open: true, selectedIndex: 0 };
			});
		} else {
			closeAutocomplete();
		}

		// Notify parent of content change
		const value = div.innerText || '';
		onUserNotesChange(value);

		// Auto-fill title
		if (!draft.name && !autoFilledRef.current && value.trim()) {
			autoFilledRef.current = true;
			const now = new Date();
			const y = now.getFullYear();
			const mo = String(now.getMonth() + 1).padStart(2, '0');
			const d = String(now.getDate()).padStart(2, '0');
			const h = String(now.getHours()).padStart(2, '0');
			const mi = String(now.getMinutes()).padStart(2, '0');
			onTitleChange(`${y}-${mo}-${d} ${h}:${mi}`);
		}

		// Extract tags from content for metadata
		const newTags = extractTagsFromContent(value);
		for (const tag of newTags) {
			if (!draft.tags.includes(tag)) onInlineTag?.(tag);
		}
	}, [draft.name, draft.tags, getEditorText, onUserNotesChange, onTitleChange, onInlineTag, closeAutocomplete]);

	useEffect(() => {
		if (!draft.name && !draft.userNotes) {
			autoFilledRef.current = false;
		}
	}, [draft.name, draft.userNotes]);

	const insertTagFromAutocomplete = useCallback((tagName: string) => {
		const div = editorRef.current;
		if (!div) return;
		const sel = window.getSelection();
		if (!sel?.rangeCount) { closeAutocomplete(); return; }
		const range = sel.getRangeAt(0);
		const node = range.startContainer;
		if (node.nodeType !== Node.TEXT_NODE) { closeAutocomplete(); return; }
		const text = node.nodeValue || '';
		const pos = range.startOffset;
		const beforeCursor = text.slice(0, pos);
		const hashMatch = beforeCursor.match(/#([^\s#]*)$/);
		if (!hashMatch) { closeAutocomplete(); return; }
		const matchStart = hashMatch.index!;
		const afterCursor = text.slice(pos);

		const fragment = document.createDocumentFragment();
		if (matchStart > 0) fragment.appendChild(document.createTextNode(text.slice(0, matchStart)));
		const span = document.createElement('span');
		span.className = 'inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary';
		span.contentEditable = 'false';
		span.textContent = '#' + tagName;
		fragment.appendChild(span);
		fragment.appendChild(document.createTextNode(' '));
		if (afterCursor) fragment.appendChild(document.createTextNode(afterCursor));
		node.parentNode!.replaceChild(fragment, node);

		const newRange = document.createRange();
		newRange.setStartAfter(span.nextSibling!);
		newRange.collapse(true);
		sel.removeAllRanges();
		sel.addRange(newRange);

		const value = div.innerText || '';
		onUserNotesChange(value);
		onInlineTag?.(tagName);
		closeAutocomplete();
	}, [onUserNotesChange, onInlineTag, closeAutocomplete]);

	const insertEditTag = useCallback((tagName: string) => {
		const ta = editTextareaRef.current;
		if (!ta) { closeAutocomplete(); return; }
		const start = ta.selectionStart;
		const text = editContent;
		const before = text.slice(0, start);
		const match = before.match(/#([^\s#]*)$/);
		if (!match) { closeAutocomplete(); return; }
		const matchStart = match.index!;
		const beforeText = text.slice(0, matchStart);
		const afterText = text.slice(start);
		const newText = beforeText + "#" + tagName + " " + afterText;
		setEditContent(newText);
		onInlineTag?.(tagName);
		closeAutocomplete();
		setTimeout(() => {
			ta.focus();
			const pos = matchStart + tagName.length + 2;
			ta.setSelectionRange(pos, pos);
		}, 0);
	}, [editContent, onInlineTag, closeAutocomplete]);

	const insertFormat = (format: FormatKey) => {
		const div = editorRef.current;
		if (!div) return;
		div.focus();
		const sel = window.getSelection();
		if (!sel?.rangeCount) return;
		const range = sel.getRangeAt(0);
		const selected = range.toString();

		let before = "", after = "";

		switch (format) {
			case "bold":
				before = "**"; after = "**";
				break;
			case "underline":
				before = "<u>"; after = "</u>";
				break;
			case "highlight":
				before = "=="; after = "==";
				break;
			case "ol":
				before = "\n1. ";
				break;
			case "ul":
				before = "\n- ";
				break;
			case "tag":
				setShowTagPicker((prev) => !prev);
				return;
		}

		const insertText = before + (selected || "") + after;
		range.deleteContents();
		range.insertNode(document.createTextNode(insertText));
		const newRange = document.createRange();
		const textNode = range.startContainer;
		if (after) {
			newRange.setStart(textNode, before.length + (selected || '').length);
		} else {
			newRange.setStartAfter(textNode);
		}
		newRange.collapse(true);
		sel.removeAllRanges();
		sel.addRange(newRange);
		dispatchEvent(new Event('input', { bubbles: true }));
	};

	const startEditing = (note: JournalView) => {
		setEditingCardId(note.id);
		setEditName(note.name ?? "");
		setEditContent(note.userNotes ?? "");
	};

	const cancelEditing = () => {
		setEditingCardId(null);
		setEditName("");
		setEditContent("");
	};

	const insertEditFormat = (format: FormatKey) => {
		const ta = editTextareaRef.current;
		if (!ta) return;
		const start = ta.selectionStart;
		const end = ta.selectionEnd;
		const text = editContent;
		const selected = text.substring(start, end);
		let before = "", after = "", posOffset = 0;
		switch (format) {
			case "bold": before = "**"; after = "**"; posOffset = 2; break;
			case "underline": before = "<u>"; after = "</u>"; posOffset = 3; break;
			case "highlight": before = "=="; after = "=="; posOffset = 2; break;
			case "ol": before = "\n1. "; posOffset = 4; break;
			case "ul": before = "\n- "; posOffset = 2; break;
			case "tag": return;
		}
		const insert = before + (selected || "") + after;
		const newText = text.substring(0, start) + insert + text.substring(end);
		setEditContent(newText);
		setTimeout(() => {
			ta.focus();
			const cursorStart = start + posOffset;
			const cursorEnd = selected ? start + insert.length - posOffset : cursorStart;
			ta.setSelectionRange(cursorStart, cursorEnd);
		}, 0);
	};

	const handleSaveEdit = async () => {
		if (editingCardId === null) return;
		setIsSaving(true);
		try {
			await onSaveCardEdit(editingCardId, {
				name: editName || null,
				user_notes: editContent || null,
			});
			cancelEditing();
		} catch (err) {
			console.error("[saveCardEdit] API error:", err);
		} finally {
			setIsSaving(false);
		}
	};

	// Auto-resize edit textarea when content changes
	useEffect(() => {
		const ta = editTextareaRef.current;
		if (!ta) return;
		ta.style.height = "auto";
		ta.style.height = ta.scrollHeight + "px";
	}, [editContent, editingCardId]);

	const handleNewNoteFocus = useCallback(() => {
		setIsFocused(true);
		const el = editorRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = el.scrollHeight + 48 + "px";
	}, []);

	const handleNewNoteBlur = useCallback(() => {
		setIsFocused(false);
		onUserNotesBlur(getEditorText());
		const el = editorRef.current;
		if (!el) return;
		const text = el.innerText || "";
		if (text.trim()) return;
		el.style.height = "";
	}, []);

	const toggleCard = (id: number) => {
		setExpandedCards((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const notesList = useMemo(() => notesData?.journals ?? [], [notesData]);
	const sortedNotes = useMemo(() => {
		let filtered = notesList;

		// Filter by similar notes: show only notes sharing tags with the target
		if (similarToNoteId) {
			const targetNote = notesList.find((j) => j.id === similarToNoteId);
			const targetTags = new Set((targetNote?.tags ?? []).map((t) => t.tagName));
			if (targetTags.size > 0) {
				filtered = notesList.filter((j) =>
					(j.tags ?? []).some((t) => targetTags.has(t.tagName)),
				);
			}
		}

		if (tagFilter) {
			filtered = notesList.filter((j) =>
				(j.tags ?? []).some((t) => t.tagName === tagFilter),
			);
		}
		const sorted = [...filtered].sort((a, b) => {
			const aPinned = pinnedIds.includes(a.id);
			const bPinned = pinnedIds.includes(b.id);
			if (aPinned && !bPinned) return -1;
			if (!aPinned && bPinned) return 1;
			return 0;
		});
		if (filterMode === "random") {
			void randomShuffle;
			const shuffled = [...sorted].sort(() => Math.random() - 0.5);
			return shuffled.slice(0, 3);
		}
		return sorted;
	}, [notesList, pinnedIds, filterMode, tagFilter, similarToNoteId, randomShuffle]);

	const formatTime = (dateStr: string) => {
		const d = new Date(dateStr);
		return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
			{/* Input area - auto-expanding (hidden when searching or filtering) */}
			{/* Search bar */}
			<div className="relative mb-2 mx-4 flex items-center gap-1">
				{showLeftToggle && (
					<button
						type="button"
						onClick={onToggleLeft}
						className={`flex-shrink-0 p-1 -ml-1 transition-colors ${isLeftOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<line x1="3" y1="6" x2="21" y2="6"/>
							<line x1="3" y1="12" x2="21" y2="12"/>
							<line x1="3" y1="18" x2="21" y2="18"/>
						</svg>
					</button>
				)}
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="搜索笔记..."
						className="w-full h-8 rounded-lg border border-border/30 bg-background/50 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 focus:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)] transition-all duration-200"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
						>
							<X className="w-3.5 h-3.5" />
						</button>
					)}
				</div>
				{showRightToggle && (
					<button
						type="button"
						onClick={onToggleRight}
						className={`flex-shrink-0 p-1 -mr-1 transition-colors ${isRightOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
						</svg>
					</button>
				)}
			</div>
			{!debouncedSearch && !heatmapFilterDate && !tagFilter && !similarToNoteId && (
			<div className="px-4 pt-3 pb-2">
				<div
					className={"relative rounded-xl border bg-background transition-all duration-200 "
						+ (isFocused ? "border-primary/40 shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]" : "border-border/40")}
				>
					<div
						ref={editorRef}
						contentEditable
						suppressContentEditableWarning
						onInput={handleEditorInput}
						onKeyDown={(e) => {
							if (!tagAutocompleteVisible || filteredTags.length === 0) return;
							if (e.key === 'ArrowDown') {
								e.preventDefault();
								setTagAutocomplete(prev => ({
									...prev,
									selectedIndex: Math.min(prev.selectedIndex + 1, filteredTags.length - 1),
								}));
							} else if (e.key === 'ArrowUp') {
								e.preventDefault();
								setTagAutocomplete(prev => ({
									...prev,
									selectedIndex: Math.max(prev.selectedIndex - 1, 0),
								}));
							} else if (e.key === 'Enter' || e.key === 'Tab') {
								e.preventDefault();
								const selected = filteredTags[tagAutocomplete.selectedIndex];
								if (selected) insertTagFromAutocomplete(selected);
							} else if (e.key === 'Escape') {
								closeAutocomplete();
							}
						}}
						onKeyDownCapture={(e) => {
							// 列表续行：在列表项末尾按 Enter 自动插入下一个编号
							if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
							if (tagAutocompleteVisible) return;
							const div = editorRef.current;
							if (!div) return;
							const sel = window.getSelection();
							if (!sel?.rangeCount) return;
							const range = sel.getRangeAt(0);
							if (!range.collapsed) return;
							const node = range.startContainer;
							if (node.nodeType !== Node.TEXT_NODE) return;
							const text = node.nodeValue || '';
							const pos = range.startOffset;
							const beforeCursor = text.slice(0, pos);
							// 取当前行（最后一个换行后的内容）
							const lastNL = beforeCursor.lastIndexOf('\n');
							const currentLine = beforeCursor.slice(lastNL + 1);
							// 有序列表：1. / 2. ...
							const olMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
							// 无序列表：- / * / +
							const ulMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
							if (olMatch) {
								const [, indent, numStr] = olMatch;
								const nextNum = parseInt(numStr, 10) + 1;
								const insertText = `\n${indent}${nextNum}. `;
								e.preventDefault();
								document.execCommand('insertText', false, insertText);
								return;
							}
							if (ulMatch) {
								const [, indent, marker] = ulMatch;
								const insertText = `\n${indent}${marker} `;
								e.preventDefault();
								document.execCommand('insertText', false, insertText);
							}
						}}
						onFocus={handleNewNoteFocus}
						onBlur={handleNewNoteBlur}
						data-placeholder={t("contentPlaceholder")}
						className="w-full text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none px-3 pt-3 min-h-[80px] h-[80px] whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/70"
					/>
					{/* Tag autocomplete dropdown for new note editor */}
					{tagAutocompleteVisible && filteredTags.length > 0 && !editingCardId && cursorPos && (
						<div
							ref={autocompleteRef}
							className="fixed z-[100] min-w-[200px] max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg"
							style={{ top: (cursorPosRef.current ?? cursorPos).top, left: (cursorPosRef.current ?? cursorPos).left }}
						>
							{filteredTags.map((tag, i) => (
								<button
									key={tag}
									type="button"
									className={"w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors "
										+ (i === tagAutocomplete.selectedIndex
											? "bg-accent text-accent-foreground"
											: "text-muted-foreground hover:bg-muted/40")}
									onMouseDown={(e) => {
										e.preventDefault();
										insertTagFromAutocomplete(tag);
									}}
									onMouseEnter={() => setTagAutocomplete(prev => ({ ...prev, selectedIndex: i }))}
								>
									<span className="text-primary/60">#</span>
									{tag}
								</button>
							))}
						</div>
					)}
					{/* Tag autocomplete for edit textarea */}
					{tagAutocompleteVisible && filteredTags.length > 0 && editingCardId && cursorPos && (
						<div
							ref={autocompleteRef}
							className="fixed z-[100] min-w-[200px] max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg"
							style={{ top: (cursorPosRef.current ?? cursorPos).top, left: (cursorPosRef.current ?? cursorPos).left }}
						>
							{filteredTags.map((tag, i) => (
								<button
									key={tag}
									type="button"
									className={"w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors "
										+ (i === tagAutocomplete.selectedIndex
											? "bg-accent text-accent-foreground"
											: "text-muted-foreground hover:bg-muted/40")}
									onMouseDown={(e) => {
										e.preventDefault();
										insertEditTag(tag);
									}}
									onMouseEnter={() => setTagAutocomplete(prev => ({ ...prev, selectedIndex: i }))}
								>
									<span className="text-primary/60">#</span>
									{tag}
								</button>
							))}
						</div>
					)}
					{/* Toolbar + Send button at bottom */}
					<div className="flex items-center justify-between px-2 pb-2 pt-1">
						<div className="flex items-center gap-0.5">
							{FORMAT_ACTIONS.map(({ key, icon: Icon, title }) => (
								<button
									key={key}
									type="button"
									onClick={() => insertFormat(key)}
									title={title}
									className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
								>
									<Icon className="w-4 h-4" />
								</button>
							))}
							{showTagPicker && (
								<input
									autoFocus
									placeholder="..."
									className="ml-2 text-xs px-2 py-0.5 rounded border border-border bg-background w-32 focus-visible:outline-none"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											const val = (e.target as HTMLInputElement).value.trim();
											if (val) {
												onUserNotesChange(
													draft.userNotes + (draft.userNotes ? "\n" : "") + "#" + val,
												);
											}
											setShowTagPicker(false);
										}
										if (e.key === "Escape") setShowTagPicker(false);
									}}
									onBlur={() => setShowTagPicker(false)}
								/>
							)}
							<span className="ml-3 text-[10px] text-muted-foreground/40 self-center">
								Markdown
							</span>
						</div>
						<button
							type="button"
							onMouseDown={(e) => {
								e.preventDefault();
								if (draft.userNotes.trim()) {
									onSubmit();
								}
							}}
							disabled={!draft.userNotes.trim()}
							className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 active:scale-[0.97]"
						>
							<Send className="w-3.5 h-3.5" />
						</button>
					</div>
				</div>
			</div>
			)}

			{/* Notes list - remaining */}
			<div className="px-4 py-3 space-y-2">
				{debouncedSearch && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<span className="text-xs font-medium text-primary/80 bg-primary/8 rounded-full px-2.5 py-1 border border-primary/10">
							搜索: "{debouncedSearch}"
						</span>
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
						>
							清除
						</button>
					</div>
				)}
				{heatmapFilterDate && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<span className="text-xs font-medium text-primary/80 bg-primary/8 rounded-full px-2.5 py-1 border border-primary/10">
							{heatmapFilterDate.getFullYear()}-{String(heatmapFilterDate.getMonth() + 1).padStart(2, "0")}-{String(heatmapFilterDate.getDate()).padStart(2, "0")}
						</span>
						<button
							type="button"
							onClick={onClearHeatmapFilter}
							className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
						>
							{t("sidebarFilterAll")}
						</button>
					</div>
				)}
				{filterMode === "random" && (
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-medium text-primary/70">{t("sidebarFilterRandom")}</span>
						<button
							type="button"
							onClick={() => { setRandomShuffle((prev) => prev + 1) }}
							className="rounded-lg p-1.5 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all duration-200"
							title={t("sidebarFilterRandom")}
						>
							<RefreshCw className="w-3.5 h-3.5" />
						</button>
					</div>
				)}
				{tagFilter && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<span className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary/80 border border-primary/10">
							# {tagFilter}
						</span>
					</div>
				)}
				{similarToNoteId && (
					<div className="flex items-center gap-2 mb-3 px-2">
						<GitFork className="w-3.5 h-3.5 text-primary/40" />
						<span className="text-xs font-medium text-primary/80">
							{t("similarToNote")}
						</span>
						<button
							type="button"
							onClick={onClearSimilarFilter}
							className="text-xs text-muted-foreground hover:text-foreground underline transition-colors ml-1"
						>
							{t("clearSimilarFilter")}
						</button>
					</div>
				)}
				{isNotesLoading ? (
					// 骨架屏加载效果
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="rounded-xl border border-border/30 bg-card px-4 py-3 animate-pulse">
								<Skeleton className="h-3 bg-muted rounded w-3/4 mb-2" />
								<Skeleton className="h-2.5 bg-muted rounded w-full mb-1.5" />
								<Skeleton className="h-2.5 bg-muted rounded w-2/3 mb-2" />
								<div className="flex gap-2">
									<Skeleton className="h-4 bg-muted rounded-full w-12" />
									<Skeleton className="h-4 bg-muted rounded-full w-16" />
								</div>
							</div>
						))}
					</div>
				) : sortedNotes.length === 0 ? (
					<div className="text-xs text-muted-foreground/50 italic text-center pt-8">
						{locale === "zh" ? "暂无笔记" : "No notes yet"}
					</div>
				) : (
					sortedNotes.map((note) => {
						const isExpanded = expandedCards.has(note.id);
						const contentLines = note.userNotes?.split("\n") ?? [];
						const isLong = contentLines.length > 20;
						const displayContent = isExpanded ? contentLines : contentLines.slice(0, 20);
						const isEditing = editingCardId === note.id;

						return (
						<div key={note.id}>

							<motion.div
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
								className={"group w-full rounded-xl border px-4 py-3 transition-all duration-200 "
									+ (isEditing
										? "border-primary/50 ring-1 ring-primary/20 bg-background"
										: draft.id === note.id
											? "border-primary/30 bg-primary/[0.02] ring-1 ring-primary/10"
											: "border-border/30 bg-card hover:border-border/60 hover:bg-muted/[0.02]")
									+ (pinnedIds.includes(note.id) ? " relative" : "")}
							>
								{isEditing ? (
									// --- Inline edit mode ---
									<div className="space-y-2">
										<input
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
											placeholder={t("titlePlaceholder")}
											className="w-full text-sm font-semibold bg-transparent border-b border-border/40 pb-1 focus-visible:outline-none focus-visible:border-primary/40"
										/>
										<div className="relative">
											<textarea
												ref={editTextareaRef}
												value={editContent}
												onChange={(e) => {
													setEditContent(e.target.value);
													const val = e.target.value;
													const selStart = e.target.selectionStart;
													const before = val.slice(0, selStart);
													const m = before.match(/#([^\s#]*)$/);
													if (m) {
																			const taRect = e.target.getBoundingClientRect();
																			const lh = 20;
																			const lc = val.slice(0, selStart).split('\n').length - 1;
																			const cursorLineText = (val.slice(0, selStart).split('\n').pop()) || '';
																			const measure = document.createElement('span');
																			measure.style.cssText = 'font-size:12px;line-height:20px;font-family:inherit;visibility:hidden;position:absolute;white-space:pre;letter-spacing:normal;';
																			measure.textContent = cursorLineText;
																			document.body.appendChild(measure);
																			const textWidth = measure.offsetWidth;
																			document.body.removeChild(measure);
																			const taStyle = window.getComputedStyle(e.target);
																			const paddingLeft = parseFloat(taStyle.paddingLeft) || 0;
																			const pos = {
																				top: taRect.top + (lc + 1) * lh + 4,
																				left: taRect.left + paddingLeft + textWidth
																			};
																			cursorPosRef.current = pos;
																			setCursorPos(pos);
														setTagAutocomplete(prev => {
															if (prev.open && prev.query === m[1] && prev.selectedIndex === 0) return prev;
															return { query: m[1], open: true, selectedIndex: 0 };
														});
													} else {
														closeAutocomplete();
													}
												}}
												onKeyDown={(e) => {
													if (!tagAutocompleteVisible || filteredTags.length === 0) return;
													if (e.key === 'ArrowDown') {
														e.preventDefault();
														setTagAutocomplete(prev => ({ ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, filteredTags.length - 1) }));
													} else if (e.key === 'ArrowUp') {
														e.preventDefault();
														setTagAutocomplete(prev => ({ ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) }));
													} else if (e.key === 'Enter' || e.key === 'Tab') {
														e.preventDefault();
														const selected = filteredTags[tagAutocomplete.selectedIndex];
														if (selected) insertEditTag(selected);
													} else if (e.key === 'Escape') {
														closeAutocomplete();
													}
												}}
												onKeyDownCapture={(e) => {
													// 列表续行：在列表项末尾按 Enter 自动插入下一个编号
													if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
													if (tagAutocompleteVisible) return;
													const ta = editTextareaRef.current;
													if (!ta) return;
													const start = ta.selectionStart;
													if (start !== ta.selectionEnd) return;
													const val = editContent;
													const before = val.slice(0, start);
													const lastNL = before.lastIndexOf('\n');
													const currentLine = before.slice(lastNL + 1);
													const olMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
													const ulMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
													let insertText: string | null = null;
													if (olMatch) {
														const [, indent, numStr] = olMatch;
														const nextNum = parseInt(numStr, 10) + 1;
														insertText = `\n${indent}${nextNum}. `;
													} else if (ulMatch) {
														const [, indent, marker] = ulMatch;
														insertText = `\n${indent}${marker} `;
													}
													if (insertText) {
														e.preventDefault();
														const newText = val.slice(0, start) + insertText + val.slice(start);
														setEditContent(newText);
														requestAnimationFrame(() => {
															ta.focus();
															const cursorPos = start + insertText!.length;
															ta.setSelectionRange(cursorPos, cursorPos);
														});
													}
												}}
												placeholder={t("contentPlaceholder")}
												rows={4}
												className="w-full resize-none bg-background text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none min-h-[80px]"
											/>
										</div>
										{(function() {
											const editTags = extractTagsFromContent(editContent);
											if (editTags.length === 0) return null;
											return (
												<div className="flex flex-wrap gap-1 px-0.5 pb-1">
													{editTags.map(function(tag) {
														return <span key={tag} className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
															#{tag}
														</span>;
													})}
												</div>
											);
										})()}
										<div className="flex items-center justify-between gap-2 pt-1">
											<div className="flex items-center gap-0.5">
												{FORMAT_ACTIONS.filter(f => f.key !== "tag").map(({ key, icon: Icon, title }) => (
													<button
														key={key}
														type="button"
														onClick={() => insertEditFormat(key)}
														title={title}
														className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
													>
														<Icon className="w-4 h-4" />
													</button>
												))}
												<span className="ml-2 text-[10px] text-muted-foreground/40">Markdown</span>
											</div>
											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={cancelEditing}
													disabled={isSaving}
													className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
												>
													<X className="w-3.5 h-3.5" />
													{t("cancel")}
												</button>
												<button
													type="button"
													onClick={handleSaveEdit}
													disabled={isSaving}
													className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
												>
													<Check className="w-3.5 h-3.5" />
													{isSaving ? t("saving") : t("save")}
												</button>
											</div>
										</div>
									</div>
								) : (
									// --- Display mode ---
									<>
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1 min-w-0">
												{note.name && (
													<div className="text-[10px] text-muted-foreground/50 mb-1 truncate">
														{pinnedIds.includes(note.id) && (
															<Pin className="w-3 h-3 inline-block mr-1 text-primary/60 -mt-0.5" />
														)}
														{note.name}
													</div>
												)}
											</div>
											{!isEditing && (
												<>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															addLinkedNote({
																id: note.id,
																name: note.name,
																userNotes: note.userNotes,
																date: note.date,
																tags: note.tags.map((t) => t.tagName),
															});
															// 打开 Chat 面板 - 切换到 list 视图（日记视图不使用面板系统）
															useUiStore.getState().setActiveView("list");
															// 等一帧让视图渲染后再设置面板
															requestAnimationFrame(() => {
																useUiStore.getState().setPanelPinned("panelB", false);
																setPanelFeature("panelB", "chat");
																if (!useUiStore.getState().isPanelBOpen) useUiStore.getState().togglePanelB();
															});
														}}
														title={locale === "zh" ? "添加到对话" : "Add to chat"}
														className="rounded p-1 -mt-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
													>
														<MessageCircle className="w-3.5 h-3.5" />
													</button>
													<button
														type="button"
														onClick={(e) => { e.stopPropagation(); onSimilarClick?.(note.id); }}
														title={t("similarNotes")}
														className="rounded p-1 -mt-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
													>
														<GitFork className="w-3.5 h-3.5" />
													</button>
												</>
											)}
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<button
														type="button"
														className="rounded p-1 text-muted-foreground/40 hover:text-foreground hover:bg-muted/40 transition-colors -mr-1 -mt-1 flex-shrink-0"
													>
														<MoreHorizontal className="w-3.5 h-3.5" />
													</button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="min-w-[120px]">
													<DropdownMenuItem onClick={() => startEditing(note)}>
														<Pencil className="w-3.5 h-3.5 mr-2" />
														{t("edit")}
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => onAnnotate?.(note)}>
														<MessageSquarePlus className="w-3.5 h-3.5 mr-2" />
														批注
													</DropdownMenuItem>
													<DropdownMenuItem onClick={() => onTogglePin(note.id)}>
														{pinnedIds.includes(note.id) ? (
															<><PinOff className="w-3.5 h-3.5 mr-2" />{t("unpin")}</>
														) : (
															<><Pin className="w-3.5 h-3.5 mr-2" />{t("pin")}</>
														)}
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => setDeleteDialogNote(note)}
														className="text-destructive focus:text-destructive"
													>
														<Trash2 className="w-3.5 h-3.5 mr-2" />
														{t("delete")}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
										<div
											className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
											onDoubleClick={() => startEditing(note)}
										>
											<NoteMarkdown content={displayContent.join("\n")} />
											{!isExpanded && isLong && (
												<span className="text-muted-foreground/40">{"\n"}...</span>
											)}
										</div>
										{isLong && (
											<button
												type="button"
												onClick={() => toggleCard(note.id)}
												className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary mt-1 transition-colors"
											>
												{isExpanded ? (
													<><ChevronUp className="w-3 h-3" />{" "}</>
												) : (
													<><ChevronDown className="w-3 h-3" />{" "}({contentLines.length})</>
												)}
											</button>
										)}
										<div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/50 hidden">
											<Clock className="w-3 h-3 text-muted-foreground/40" />
											{formatTime(note.createdAt)}
										</div>
										{note.relatedNoteIds && note.relatedNoteIds.length > 0 && (() => {
											const refNote = notesList.find(n => n.id === note.relatedNoteIds[0]) ?? relatedNotesData?.find(n => n.id === note.relatedNoteIds[0]);
											if (!refNote) return null;
											const firstLine = (refNote.userNotes || '').split('\n')[0] || '';
											return (
												<button
													type="button"
													onClick={() => onCompareNotes?.(refNote, note)}
													className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground/50 hover:text-primary/70 transition-colors group/reflink w-full text-left"
												>
													<span className="w-3 h-3 rounded-full bg-foreground/20 flex items-center justify-center shrink-0">
														<ArrowUpLeft className="w-2 h-2 text-background" />
													</span>
													<span className="truncate">{formatTime(refNote.createdAt)} {firstLine}</span>
												</button>
											);
										})()}
									</>
								)}
							</motion.div>
						</div>
						);
					})
				)}
				<AlertDialog open={deleteDialogNote !== null} onOpenChange={(open) => { if (!open) setDeleteDialogNote(null); }}>
					<AlertDialogContent className="p-0 gap-0 overflow-hidden max-w-sm border-l-[3px] border-l-destructive/40 shadow-xl">
						<div className="flex gap-4 p-6 pb-5">
							<div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center ring-1 ring-destructive/20">
								<TriangleAlert className="w-5 h-5 text-destructive" />
							</div>
							<div className="flex-1 min-w-0 pt-0.5">
								<AlertDialogHeader className="space-y-1 p-0">
									<AlertDialogTitle className="text-base font-semibold">{t("deleteConfirmTitle")}</AlertDialogTitle>
									<AlertDialogDescription className="text-sm text-muted-foreground/70 leading-relaxed">
										{t("deleteConfirmMessage")}
									</AlertDialogDescription>
								</AlertDialogHeader>
							</div>
						</div>
						<div className="h-px bg-border/40" />
						<AlertDialogFooter className="px-6 py-3.5 sm:justify-end gap-2">
							<AlertDialogCancel className="relative rounded-lg h-9 px-4 text-xs font-medium border border-border/60 bg-background hover:bg-muted/40 hover:text-foreground transition-all active:scale-[0.97]">
								{t("cancel")}
							</AlertDialogCancel>
							<AlertDialogAction
								className="relative rounded-lg h-9 px-4 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.97] transition-all shadow-sm"
								onClick={() => {
									if (deleteDialogNote !== null) onDelete(deleteDialogNote);
									setDeleteDialogNote(null);
								}}
							>
								{t("delete")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
			</div>
		</div>
	);
}
