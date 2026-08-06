"use client";

import type { Editor } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import MarkdownIt from "markdown-it";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import TurndownService from "turndown";
import { VoiceInputButton } from "@/components/ui/voice-input-button";

interface NotesEditorProps {
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
}

export function NotesEditor({
	value,
	onChange,
	onBlur,
}: NotesEditorProps) {
	const t = useTranslations("todoDetail");
	const lastValueRef = useRef(value);

	const markdownParser = useMemo(
		() => new MarkdownIt({ breaks: true, linkify: true }),
		[],
	);
	const turndown = useMemo(() => {
		const service = new TurndownService({
			codeBlockStyle: "fenced",
			emDelimiter: "*",
		});
		service.keep(["del"]);
		return service;
	}, []);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: [
			StarterKit,
			Placeholder.configure({
				placeholder: t("notesPlaceholder"),
				emptyEditorClass: "text-muted-foreground",
			}),
		],
		content: value ? markdownParser.render(value) : "",
		onUpdate: ({ editor }: { editor: Editor }) => {
			const html = editor.getHTML();
			const markdown = turndown.turndown(html);
			lastValueRef.current = markdown;
			onChange(markdown);
		},
		onBlur: () => {
			onBlur?.();
		},
		editorProps: {
			attributes: {
				class:
					"min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground prose prose-sm max-w-none transition-colors focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20",
			},
		},
	});

	useEffect(() => {
		if (!editor) return;
		if (value === lastValueRef.current) return;
		editor.commands.setContent(value ? markdownParser.render(value) : "", {
			emitUpdate: false,
		});
		lastValueRef.current = value;
	}, [editor, markdownParser, value]);

	return (
		<div
			role="group"
			className="mb-6"
		>
			<div className="relative">
				<EditorContent editor={editor} />
				<div className="absolute right-1.5 top-1.5">
					<VoiceInputButton
						ownerId="notes-editor"
						editorRef={{ current: editor }}
						onTranscript={(text) => {
							if (editor) editor.chain().focus().insertContent(` ${text}`).run();
						}}
					/>
				</div>
			</div>
		</div>
	);
}
