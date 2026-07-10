"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useEffect, useRef } from "react";

interface NewTodoInlineFormProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (e?: React.FormEvent) => void;
	onCancel: () => void;
}

export function NewTodoInlineForm({
	value,
	onChange,
	onSubmit,
	onCancel,
}: NewTodoInlineFormProps) {
	const t = useTranslations("todoList");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	useEffect(() => {
		if (value === "") {
			inputRef.current?.focus();
		}
	}, [value]);

	return (
		<form
			onSubmit={onSubmit}
			onReset={onCancel}
			className="group flex items-center gap-3 rounded-xl border border-border/30 bg-muted/[0.02] px-3.5 py-2.5 transition-all duration-200 focus-within:border-primary/30 focus-within:shadow-[0_0_0_1px_rgba(var(--primary)/0.08)]"
			onClick={() => inputRef.current?.focus()}
			onKeyDown={(e) => {
				if (e.currentTarget !== e.target) return;
				if (e.key === " ") {
					e.preventDefault();
					inputRef.current?.focus();
					return;
				}
				if (e.key === "Enter") {
					inputRef.current?.focus();
				}
			}}
		>
			<Plus className="h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors duration-200" />
			<input
				ref={inputRef}
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={t("addTodo")}
				className="flex-1 bg-transparent text-sm text-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none"
				required
			/>
			<button type="submit" className="sr-only">
				{t("submit")}
			</button>
			<button type="reset" className="sr-only">
				{t("reset")}
			</button>
		</form>
	);
}
