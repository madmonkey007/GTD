"use client";

import type { Editor } from "@tiptap/core";
import { Node } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import MarkdownIt from "markdown-it";
import { Bold, Highlighter, Underline, ListOrdered, List, Hash, AtSign, Search as SearchIcon, ImagePlus, Link as LinkIcon  } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import TurndownService from "turndown";
import { uploadJournalImage } from "@/lib/api";
import { compressImageIfNeeded } from "@/lib/imageCompress";
import { toast } from "@/lib/toast";
import { VoiceInputButton } from "@/components/ui/voice-input-button";

type Variant = "create" | "edit";

export interface NoteLinkItem {
	id: number;
	name: string;
	preview: string;
}

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
	/** 用于 @ 关联的笔记列表 */
	noteLinkList?: NoteLinkItem[];
	/** 点击关联笔记时的回调 */
	onLinkNote?: (noteId: number) => void;
	/** 已关联的笔记列表（用于在编辑器中显示 chip） */
	linkedNoteTitles?: { id: number; name: string }[];
	/** 移除关联笔记的回调 */
	onRemoveLink?: (noteId: number) => void;
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

/**
 * markdown-it 把连续的 ![](url) 渲染成「仅含图片的 <p>」。
 * 这里把它们改写成 <div data-image-group>（收集其中所有 <img>），供 ImageGroup 节点解析。
 * 单张图片也会被包成 1 元素 group。失败回退原 HTML，保护既有数据。
 */
function wrapImageGroups(html: string): string {
	// 注意：本文件顶部 import { Node } from "@tiptap/core" 遮蔽了全局 Node，
	// 因此不能用 Node.TEXT_NODE，改用 nodeName === "#text"。
	if (typeof window === "undefined" || typeof DOMParser === "undefined") return html;
	try {
		const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
		const root = doc.body.firstChild as HTMLElement;
		root.querySelectorAll("p").forEach((p) => {
			const imgs = Array.from(p.querySelectorAll("img"));
			if (imgs.length === 0) return;
			// 段落里除了 img / <br> / 空白文本外不能有其它内容
			const hasOther = Array.from(p.childNodes).some((c) => {
				const nn = c.nodeName;
				if (nn === "#text") return (c.textContent || "").trim() !== "";
				return nn !== "IMG" && nn !== "BR";
			});
			if (hasOther) return;
			const div = doc.createElement("div");
			div.setAttribute("data-image-group", "");
			imgs.forEach((img) => div.appendChild(img));
			p.replaceWith(div);
		});
		return root.innerHTML;
	} catch {
		return html;
	}
}

const ImageGroupNodeView = ({
	node,
	deleteNode,
	updateAttributes,
}: {
	node: any;
	deleteNode: () => void;
	updateAttributes: (attrs: Record<string, any>) => void;
}) => {
	const images = (node.attrs.images ?? []) as { src: string; alt?: string }[];
	const removeAt = (i: number) => {
		const next = images.filter((_, idx) => idx !== i);
		if (next.length === 0) deleteNode();
		else updateAttributes({ images: next });
	};
	return (
		<NodeViewWrapper className="my-1">
			<div className="flex flex-wrap gap-1.5">
				{images.map((im, i) => (
					<div key={`${im.src}-${i}`} className="relative" style={{ width: 80, height: 80 }}>
						<img
							src={im.src}
							alt={im.alt || ""}
							className="w-full h-full object-cover rounded border border-border/40 bg-muted/20"
							draggable={false}
						/>
						<button
							type="button"
							onClick={() => removeAt(i)}
							title="移除图片"
							className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-zinc-500 text-white text-[11px] leading-none flex items-center justify-center shadow hover:bg-zinc-600 hover:scale-110 transition"
						>
							✕
						</button>
					</div>
				))}
			</div>
		</NodeViewWrapper>
	);
};

// 多图节点：atom 块，attrs.images 数组；NodeView 横向紧凑排列（flex-wrap）
const ImageGroup = Node.create({
	name: "imageGroup",
	group: "block",
	atom: true,
	draggable: false,
	selectable: true,
	addAttributes() {
		return {
			images: {
				default: [] as { src: string; alt?: string }[],
				parseHTML: (el: HTMLElement) => {
					if (el.tagName === "IMG") {
						return [{ src: el.getAttribute("src") || "", alt: el.getAttribute("alt") || "" }];
					}
					return Array.from(el.querySelectorAll("img")).map((img) => ({
						src: img.getAttribute("src") || "",
						alt: img.getAttribute("alt") || "",
					}));
				},
				renderHTML: () => ({}),
			},
		};
	},
	parseHTML() {
		return [{ tag: "div[data-image-group]" }];
	},
	renderHTML({ node }: { node: any }) {
		const imgs = (node.attrs.images ?? []) as { src: string; alt?: string }[];
		return [
			"div",
			{ "data-image-group": "" },
			...imgs.map((im) => ["img", { src: im.src, alt: im.alt || "" }]),
		] as any;
	},
	addNodeView() {
		return ReactNodeViewRenderer(ImageGroupNodeView);
	},
});

export function DiaryTiptapEditor({
	value,
	onChange,
	onBlur,
	recentTags,
	onInlineTag,
	placeholder,
	variant = "create",
		toolbarEnd,
		noteLinkList,
		onLinkNote,
		linkedNoteTitles,
		onRemoveLink,
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
	const [linkPopupOpen, setLinkPopupOpen] = useState(false);
	const [linkSearch, setLinkSearch] = useState('');
	const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
	const linkPopupRef = useRef<HTMLDivElement>(null);

	const wordCount = value.replace(/\s/g, '').length;

	// Close @ popup on click outside
	useEffect(() => {
		if (!linkPopupOpen) return;
		const handler = (e: MouseEvent) => {
			if (linkPopupRef.current && !linkPopupRef.current.contains(e.target as Node)) {
				setLinkPopupOpen(false);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', handler), 0);
		return () => document.removeEventListener('mousedown', handler);
	}, [linkPopupOpen]);

	// Refs for @ keydown (avoids hook deps changing on every render)
	const noteLinkListRef = useRef(noteLinkList);
	noteLinkListRef.current = noteLinkList;
	const onLinkNoteRef = useRef(onLinkNote);
	onLinkNoteRef.current = onLinkNote;

	// 打开 @ 候选弹窗并定位（coords 来自光标或触发按钮）
	const openLinkPopup = (coords: { top: number; left: number }) => {
		// 右侧防溢出（弹窗宽 320px）
		const left = Math.max(8, Math.min(coords.left, window.innerWidth - 332));
		// 下方空间不足时向上弹
		const top = coords.top + 280 > window.innerHeight ? Math.max(8, coords.top - 290) : coords.top;
		setPopupPos({ top, left });
		setLinkPopupOpen(true);
		setLinkSearch('');
	};

	// 输入 @ 时：定位到光标处
	const handleEditorKeyDown = useCallback((view: any, event: KeyboardEvent) => {
		if (event.key === '@' && noteLinkListRef.current && onLinkNoteRef.current) {
			let coords = { top: 0, left: 0 };
			try {
				const c = view.coordsAtPos(view.state.selection.from);
				coords = { top: c.bottom + 4, left: c.left };
			} catch {
				coords = { top: 100, left: 100 };
			}
			openLinkPopup(coords);
			return true; // prevent @ from being inserted into editor content
		}
		return false;
	}, []);

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
		// imageGroup 节点 → 每张图一行 ![](url)（与多图存储格式一致）
		service.addRule("imageGroup", {
			filter: (node: any) =>
				node.nodeName === "DIV" && node.getAttribute("data-image-group") !== null,
			replacement: (_content: string, node: any) =>
				Array.from(node.querySelectorAll("img"))
					.map((img: any) => `![${img.getAttribute("alt") || ""}](${img.getAttribute("src") || ""})`)
					.join("\n"),
		});
		return service;
	}, []);

	const editorRef = useRef<Editor | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const insertImages = useCallback((items: { src: string; alt: string }[]) => {
		const ed = editorRef.current;
		if (!ed || items.length === 0) return;
		const end = ed.state.doc.content.size;
		ed.chain().focus().insertContentAt(end, { type: "imageGroup", attrs: { images: items } }).run();
	}, []);

	// 单张仍保留（网络图片 URL 等场景）
	const insertImage = useCallback((src: string, alt: string) => {
		insertImages([{ src, alt }]);
	}, [insertImages]);

	// 批量上传：最多 9 张，并发压缩+上传，全部完成后一次性插入
	const MAX_IMAGES = 9;
	const handleImageFiles = useCallback(async (files: File[]) => {
		const imgs = files.filter((f) => f.type.startsWith("image/"));
		if (imgs.length === 0) return;
		if (imgs.length > MAX_IMAGES) {
			toast(`最多添加 ${MAX_IMAGES} 张图片`, { type: "warning" });
		}
		const capped = imgs.slice(0, MAX_IMAGES);
		const results = await Promise.all(
			capped.map(async (file) => {
				try {
					const compressed = await compressImageIfNeeded(file);
					return await uploadJournalImage(compressed);
				} catch (e) {
					console.error("[DiaryTiptapEditor] 图片上传失败:", e);
					return null;
				}
			}),
		);
		const ok = results
			.filter((r): r is { url: string; alt?: string } => r !== null)
			.map((r) => ({ src: r.url, alt: r.alt ?? "" }));
		if (ok.length > 0) insertImages(ok);
	}, [insertImages]);

	const onPickFile = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		if (files.length > 0) await handleImageFiles(files);
		e.target.value = "";
	}, [handleImageFiles]);

	const onUrlImage = useCallback(() => {
		const url = window.prompt("输入图片 URL");
		if (url && url.trim()) insertImage(url.trim(), "");
	}, [insertImage]);

	// 粘贴图片：收集所有 image/* 项，忽略 text/html 内的 base64，避免 user_notes 字段暴涨
	const handlePasteImage = useCallback((_view: any, event: ClipboardEvent): boolean => {
		const items = event.clipboardData?.items;
		if (!items) return false;
		const imgs: File[] = [];
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.startsWith("image/")) {
				const f = items[i].getAsFile();
				if (f) imgs.push(f);
			}
		}
		if (imgs.length === 0) return false;
		event.preventDefault();
		void handleImageFiles(imgs);
		return true;
	}, [handleImageFiles]);

	const handleDropImage = useCallback((_view: any, event: DragEvent): boolean => {
		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return false;
		const imgs: File[] = [];
		for (let i = 0; i < files.length; i++) {
			if (files[i].type.startsWith("image/")) imgs.push(files[i]);
		}
		if (imgs.length === 0) return false;
		event.preventDefault();
		void handleImageFiles(imgs);
		return true;
	}, [handleImageFiles]);

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
			ImageGroup,
		],
		content: value ? wrapImageGroups(md.render(wrapTagsAsMentions(value))) : "",
		editorProps: {
			attributes: {
				class: variant === "create"
					? "w-full text-sm leading-relaxed text-foreground focus:outline-none px-3 pt-3 pb-2 min-h-[80px] max-h-[50vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-li:my-0"
					: "w-full text-sm leading-relaxed text-foreground focus:outline-none min-h-[120px] max-h-[50vh] overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-li:my-0",
			},
			transformPastedHTML: sanitizePastedHtml,
			handleKeyDown: handleEditorKeyDown,
			handlePaste: handlePasteImage,
			handleDrop: handleDropImage,
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
		editorRef.current = editor;
	}, [editor]);

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
			{/* 已关联笔记 chips */}
			{linkedNoteTitles && linkedNoteTitles.length > 0 && (
				<div className="flex flex-wrap gap-1 px-3 pt-1 pb-0">
					{linkedNoteTitles.map((ln: { id: number; name: string }) => (
						<span
							key={ln.id}
							className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
						>
							<AtSign className="w-2.5 h-2.5" />
							<span className="max-w-[120px] truncate">{ln.name || "无标题"}</span>
							{onRemoveLink && (
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); onRemoveLink(ln.id); }}
									className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
								>
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							)}
						</span>
					))}
				</div>
			)}
			<style>{`
				.DiaryTiptapEditor-toolbar .is-active { color: var(--primary); background: rgba(var(--primary), 0.1); }
				.ProseMirror.is-editor-empty:first-child::before { content: attr(data-placeholder); color: rgb(var(--muted-foreground) / 0.7); float: left; pointer-events: none; height: 0; }
				.ProseMirror :focus { outline: none; }
				.ProseMarkup-p { margin: 0; }
			`}</style>
			<div className="DiaryTiptapEditor-toolbar flex items-center justify-between px-2 pb-2 pt-1">
				<div className="flex items-center gap-0.5">
				{FORMAT_ACTIONS.map(({ key, icon: Icon, title }) => (
						<Fragment key={key}>
							<button
								type="button"
								title={title}
								onClick={() => runFormat(key)}
								className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
							>
								<Icon className="w-4 h-4" />
							</button>
							{key === "bold" && (
								<button
									type="button"
									title="插入图片"
									onClick={onPickFile}
									className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
								>
									<ImagePlus className="w-4 h-4" />
								</button>
							)}
						</Fragment>
					))}
					{/* @ 关联笔记 */}
					{noteLinkList && onLinkNote && (
						<button
							type="button"
							onClick={(e) => {
								if (linkPopupOpen) { setLinkPopupOpen(false); return; }
								const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
								openLinkPopup({ top: r.bottom + 4, left: r.left });
							}}
							title="关联笔记"
							className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
						>
							<AtSign className="w-4 h-4" />
						</button>
					)}
					{/* 网络图片（URL） */}
					<button
						type="button"
						title="网络图片链接"
						onClick={onUrlImage}
						className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
					>
						<LinkIcon className="w-4 h-4" />
					</button>
					<input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFileChange} className="hidden" />
				</div>
				<div className="flex items-center gap-1">
					{/* 字数统计 */}
					<span className="text-[10px] text-muted-foreground/40 select-none tabular-nums mr-1">{wordCount}</span>
					{/* 语音输入（发送按钮左侧） */}
					<VoiceInputButton
						ownerId="diary-tiptap"
						stopPropagation
						editorRef={editorRef}
						onTranscript={(text) => {
							const ed = editorRef.current;
							if (ed) ed.chain().focus().insertContent(` ${text}`).run();
						}}
					/>
					{toolbarEnd}
				</div>
			</div>
			{/* @ 候选弹窗：Portal 到 body，fixed 定位，避免被父容器 overflow/层叠遮挡 */}
			{linkPopupOpen && noteLinkList && onLinkNote && createPortal(
				<div
					ref={linkPopupRef}
					style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, zIndex: 9999 }}
					className="w-80 h-72 rounded-lg border border-border/60 bg-popover shadow-lg flex flex-col"
				>
					<div className="relative p-2">
						<SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
						<input
							type="text"
							value={linkSearch}
							onChange={(e) => setLinkSearch(e.target.value)}
							placeholder="搜索笔记..."
							className="w-full h-8 rounded-md border border-border/30 bg-background/50 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30"
						/>
					</div>
					<div className="flex-1 overflow-y-auto">
						{noteLinkList
							.map((n: NoteLinkItem) => {
								if (!linkSearch) return { item: n, score: 0 };
								const q = linkSearch.toLowerCase();
								let score = 0;
								if (n.name.toLowerCase().includes(q)) score += 10;
								if (n.preview.toLowerCase().includes(q)) score += 1;
								return { item: n, score };
							})
							.filter(x => !linkSearch || x.score > 0)
							.sort((a, b) => b.score - a.score)
							.slice(0, 10)
							.map(({ item: n }) => (
								<button
									key={n.id}
									type="button"
									onClick={() => { onLinkNote(n.id); setLinkPopupOpen(false); setLinkSearch(''); }}
									className="w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors border-b border-border/20 last:border-0"
								>
									<span className="text-[10px] text-muted-foreground/40 truncate w-full">{n.name || '无标题'}</span>
									<span className="text-xs text-foreground/80 leading-relaxed line-clamp-3 w-full">{n.preview}</span>
								</button>
							))}
						{noteLinkList.length === 0 && (
							<div className="px-3 py-4 text-xs text-muted-foreground/50 text-center">暂无笔记</div>
						)}
					</div>
				</div>,
				document.body,
			)}
		</div>
	);
}