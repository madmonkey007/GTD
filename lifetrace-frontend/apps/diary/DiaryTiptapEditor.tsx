"use client";

import type { Editor } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import MarkdownIt from "markdown-it";
import { Bold, Highlighter, Underline, ListOrdered, List, Hash } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import TurndownService from "turndown";

type Variant = "create" | "edit";

interface DiaryTiptapEditorProps {
	value: string;
	onChange: (markdown: string) => void;
	onBlur?: () => void;
	recentTags: string[];
	onInlineTag?: (tagName: string) => void;
	placeholder?: string;
	variant?: Variant;
	/** 工具栏右侧插槽（新建态的发送按钮、编辑态的取消/保存按钮） */
	toolbarEnd?: React.ReactNode;
}

interface FormatAction {
	key: "bold" | "underline" | "highlight" | "ul" | "ol" | "tag";
	icon: React.FC<{ className?: string }>;
	title: string;
}

const FORMAT_ACTIONS: FormatAction[] = [
	{ key: "bold", icon: Bold, title: "加粗" },
	{ key: "underline", icon: Underline, title: "下划线" },
	{ key: "highlight", icon: Highlighter, title: "高亮" },
	{ key: "ul", icon: List, title: "无序列表" },
	{ key: "ol", icon: ListOrdered, title: "有序列表" },
	{ key: "tag", icon: Hash, title: "标签" },
];

const ALLOWED_TAGS = new Set([
	"P", "BR", "B", "STRONG", "I", "EM", "U", "MARK", "S", "DEL",
	"A", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "CODE", "PRE",
]);

function sanitizePastedHtml(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	doc.body.querySelectorAll("*").forEach((el) => {
		for (const attr of Array.from(el.attributes)) {
			if (!(el.tagName === "A" && (attr.name === "href" || attr.name === "title"))) {
				el.removeAttribute(attr.name);
			}
		}
		if (!ALLOWED_TAGS.has(el.tagName)) {
			el.replaceWith(...Array.from(el.childNodes));
		}
	});
	return doc.body.innerHTML;
}

function wrapTagsAsMentions(markdown: string): string {
	return markdown.replace(/#([^\s#<]+)/g, (_m, tag: string) =>
		`<span data-type="mention" data-id="${tag}" data-label="${tag}"></span>`);
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function buildSuggestion(getTags: () => string[]) {
	let popup: HTMLDivElement | null = null;
	let activeProps: { command: (item: { id: string; label: string }) => void; clientRect: () => DOMRect | null; items: string[] } | null = null;
	let items: string[] = [];
	let selected = 0;

	const renderItems = () => {
		if (!popup) return;
		popup.innerHTML = "";
		if (items.length === 0) return;
		items.forEach((tag, i) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-left transition-colors "
				+ (i === selected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/40");
			btn.innerHTML = `<span class="text-primary/60">#</span>${escapeHtml(tag)}`;
			btn.addEventListener("mousedown", (e) => {
				e.preventDefault();
				activeProps?.command({ id: tag, label: tag });
			});
			popup!.appendChild(btn);
		});
	};
	const position = () => {
		if (!popup || !activeProps?.clientRect) return;
		const rect = activeProps.clientRect();
		if (!rect) return;
		popup.style.top = `${rect.bottom + 2}px`;
		popup.style.left = `${rect.left}px`;
	};

	return {
		char: "#",
		allow: () => true,
		items: ({ query }: { query: string }) => {
			const q = query.toLowerCase();
			return getTags().filter((t) => t.toLowerCase().includes(q)).slice(0, 8);
		},
		render: () => ({
			onStart: (props: any) => {
				activeProps = props;
				items = props.items ?? [];
				selected = 0;
				popup = document.createElement("div");
				popup.className = "fixed z-[100] min-w-[180px] max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-lg";
				document.body.appendChild(popup);
				renderItems();
				position();
			},
			onUpdate: (props: any) => {
				activeProps = props;
				items = props.items ?? [];
				selected = 0;
				renderItems();
				position();
			},
			onExit: () => {
				popup?.remove();
				popup = null;
				activeProps = null;
			},
			onKeyDown: (props: any) => {
				const { event } = props;
				if (event.key === "ArrowDown") {
					selected = (selected + 1) % Math.max(items.length, 1);
					renderItems();
					return true;
				}
				if (event.key === "ArrowUp") {
					selected = (selected - 1 + items.length) % Math.max(items.length, 1);
					renderItems();
					return true;
				}
				if (event.key === "Enter" || event.key === "Tab") {
					if (items[selected]) activeProps?.command({ id: items[selected], label: items[selected] });
					return true;
				}
				return false;
			},
		}),
	};
}

export function DiaryTiptapEditor({
	value,
	onChange,
	onBlur,
	recentTags,
	onInlineTag,
	placeholder,
	variant = "create",
	toolbarEnd,
}: DiaryTiptapEditorProps) {
	const recentTagsRef = useRef<string[]>(recentTags);
	recentTagsRef.current = recentTags;
	const lastValueRef = useRef(value);
	const notifiedTagsRef = useRef<Set<string>>(new Set());
	const onInlineTagRef = useRef(onInlineTag);
	onInlineTagRef.current = onInlineTag;
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onBlurRef = useRef(onBlur);
	onBlurRef.current = onBlur;

	const md = useMemo(() => new MarkdownIt({ html: true, breaks: true, linkify: true }), []);
	const turndown = useMemo(() => {
		const service = new TurndownService({ codeBlockStyle: "fenced", emDelimiter: "*" });
		service.keep(["u", "mark"]);
		service.addRule("mention", {
			filter: (node: any) =>
				node.nodeName === "SPAN" && node.getAttribute("data-type") === "mention",
			replacement: (_content: string, node: any) =>
				"#" + (node.getAttribute("data-label") || node.textContent || "").replace(/^#/, ""),
		});
		return service;
	}, []);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit,
			Highlight,
			Mention.configure({
				HTMLAttributes: {
					class: "inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary",
				},
				renderLabel: ({ node }: { node: any }) =>
					"#" + (node.attrs.label ?? node.attrs.id ?? ""),
				suggestion: buildSuggestion(() => recentTagsRef.current) as any,
			}),
			Placeholder.configure({
				placeholder: placeholder ?? "",
				emptyEditorClass: "is-editor-empty",
			}),
		],
		content: value ? md.render(wrapTagsAsMentions(value)) : "",
		editorProps: {
			attributes: {
				class: variant === "create"
					? "w-full text-sm leading-relaxed text-foreground focus:outline-none px-3 pt-3 pb-2 min-h-[80px] max-h-[50vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-li:my-0"
					: "w-full text-sm leading-relaxed text-foreground focus:outline-none min-h-[120px] max-h-[50vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-li:my-0",
			},
			transformPastedHTML: sanitizePastedHtml,
		},
		onUpdate: ({ editor }: { editor: Editor }) => {
			const markdown = turndown.turndown(editor.getHTML());
			lastValueRef.current = markdown;
			onChangeRef.current(markdown);
			const seen = new Set<string>();
			editor.state.doc.descendants((node) => {
				if (node.type.name === "mention") {
					const label = (node.attrs.label ?? node.attrs.id ?? "") as string;
					if (label && !seen.has(label)) {
						seen.add(label);
						if (!notifiedTagsRef.current.has(label)) {
							notifiedTagsRef.current.add(label);
							onInlineTagRef.current?.(label);
						}
					}
				}
				return true;
			});
		},
		onBlur: () => onBlurRef.current?.(),
	}, [md, turndown, variant, placeholder]);

	useEffect(() => {
		if (!editor) return;
		if (value === lastValueRef.current) return;
		const html = value ? md.render(wrapTagsAsMentions(value)) : "";
		editor.commands.setContent(html, { emitUpdate: false });
		lastValueRef.current = value;
		notifiedTagsRef.current = new Set();
	}, [editor, value, md]);

	const runFormat = (key: FormatAction["key"]) => {
		if (!editor) return;
		const chain = editor.chain().focus();
		switch (key) {
			case "bold": chain.toggleBold().run(); break;
			case "underline": chain.toggleUnderline().run(); break;
			case "highlight": chain.toggleHighlight().run(); break;
			case "ul": chain.toggleBulletList().run(); break;
			case "ol": chain.toggleOrderedList().run(); break;
			case "tag": chain.insertContent("#").run(); break;
		}
	};

	const borderClass = variant === "create"
		? "rounded-xl border border-border/40 bg-background"
		: "";

	return (
		<div className={`relative transition-all duration-200 ${borderClass} focus-within:border-primary/40 focus-within:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]`}>
			<EditorContent editor={editor} />
			<style>{`
				.DiaryTiptapEditor-toolbar .is-active { color: var(--primary); background: rgba(var(--primary), 0.1); }
				.ProseMirror.is-editor-empty:first-child::before { content: attr(data-placeholder); color: rgb(var(--muted-foreground) / 0.7); float: left; pointer-events: none; height: 0; }
				.ProseMirror :focus { outline: none; }
				.ProseMarkup-p { margin: 0; }
			`}</style>
			<div className="DiaryTiptapEditor-toolbar flex items-center justify-between px-2 pb-2 pt-1">
				<div className="flex items-center gap-0.5">
					{FORMAT_ACTIONS.map(({ key, icon: Icon, title }) => (
						<button
							key={key}
							type="button"
							title={title}
							onClick={() => runFormat(key)}
							className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
						>
							<Icon className="w-4 h-4" />
						</button>
					))}
				</div>
				{toolbarEnd}
			</div>
		</div>
	);
}