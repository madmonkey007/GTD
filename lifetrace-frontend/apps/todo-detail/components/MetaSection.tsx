"use client";

import { Calendar, Check, Flag, Tag as TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Todo, TodoPriority, TodoStatus, UpdateTodoInput } from "@/lib/types";
import { cn, getPriorityLabel, getStatusLabel } from "@/lib/utils";
import {
	formatScheduleSummary,
	getPriorityClassNames,
	getStatusClassNames,
	priorityOptions,
	statusOptions,
} from "../helpers";
import { DatePickerPopover } from "./DatePickerPopover";

interface MetaSectionProps {
	todo: Todo;
	allTags: string[];
	onStatusChange: (status: TodoStatus) => void;
	onPriorityChange: (priority: TodoPriority) => void;
	onTagsChange: (tags: string[]) => void;
	onScheduleChange: (input: UpdateTodoInput) => void;
}

export function MetaSection({
	todo,
	allTags,
	onStatusChange,
	onPriorityChange,
	onTagsChange,
	onScheduleChange,
}: MetaSectionProps) {
	const tCommon = useTranslations("common");
	const tTodoDetail = useTranslations("todoDetail");
	const statusMenuRef = useRef<HTMLDivElement | null>(null);
	const priorityMenuRef = useRef<HTMLDivElement | null>(null);
	const scheduleButtonRef = useRef<HTMLButtonElement | null>(null);
	const tagMenuRef = useRef<HTMLDivElement | null>(null);

	const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
	const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
	const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
	const [isEditingTags, setIsEditingTags] = useState(false);
	const [tagInput, setTagInput] = useState("");

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (statusMenuRef.current && !statusMenuRef.current.contains(target)) {
				setIsStatusMenuOpen(false);
			}
			if (
				priorityMenuRef.current &&
				!priorityMenuRef.current.contains(target)
			) {
				setIsPriorityMenuOpen(false);
			}
			if (tagMenuRef.current && !tagMenuRef.current.contains(target)) {
				setIsEditingTags(false);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsStatusMenuOpen(false);
				setIsPriorityMenuOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	useEffect(() => {
		setIsStatusMenuOpen(false);
		setIsPriorityMenuOpen(false);
		setIsDatePickerOpen(false);
		setIsEditingTags(false);
		setTagInput("");
	}, [todo.id]);

	const currentTags = todo.tags ?? [];
	const toggleTag = (tag: string) => {
		const next = currentTags.includes(tag)
			? currentTags.filter((t) => t !== tag)
			: [...currentTags, tag];
		onTagsChange(next);
	};
	const addTagFromInput = () => {
		const tag = tagInput.trim();
		if (!tag) return;
		if (!currentTags.includes(tag)) {
			onTagsChange([...currentTags, tag]);
		}
		setTagInput("");
	};

	const scheduleSummary =
		formatScheduleSummary({
			startTime: todo.startTime,
			endTime: todo.endTime,
			timeZone: todo.timeZone,
			isAllDay: todo.isAllDay,
		}) || tTodoDetail("addDeadline");

	return (
		<div className="mb-6 text-sm text-muted-foreground">
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative flex items-center" ref={statusMenuRef}>
					<button
						type="button"
						onClick={() => setIsStatusMenuOpen((prev) => !prev)}
						className={cn(
							getStatusClassNames(todo.status),
							"transition-colors hover:bg-muted/40",
						)}
						aria-expanded={isStatusMenuOpen}
						aria-haspopup="listbox"
					>
						{getStatusLabel(todo.status, tCommon)}
					</button>
					{isStatusMenuOpen && (
						<div className="pointer-events-auto absolute left-0 top-full z-120 mt-2 min-w-[170px] rounded-md border border-border bg-background shadow-lg">
							<div className="py-1" role="listbox">
								{statusOptions.map((status) => (
									<button
										key={status}
										type="button"
										onClick={() => {
											if (status !== todo.status) {
												onStatusChange(status);
											}
											setIsStatusMenuOpen(false);
										}}
										className={cn(
											"flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
											status === todo.status
												? "bg-muted/60 text-foreground"
												: "text-foreground hover:bg-muted/70",
										)}
										role="option"
										aria-selected={status === todo.status}
									>
										<span className={getStatusClassNames(status)}>
											{getStatusLabel(status, tCommon)}
										</span>
										{status === todo.status && (
											<span className="text-[11px] text-primary">
												{tTodoDetail("current")}
											</span>
										)}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="relative flex items-center" ref={priorityMenuRef}>
					<button
						type="button"
						onClick={() => setIsPriorityMenuOpen((prev) => !prev)}
						className={cn(
							getPriorityClassNames(todo.priority ?? "none"),
							"transition-colors hover:bg-muted/40",
						)}
						aria-expanded={isPriorityMenuOpen}
						aria-haspopup="listbox"
					>
						<Flag className="h-3 w-3" fill="currentColor" aria-hidden />
						{getPriorityLabel(todo.priority ?? "none", tCommon)}
					</button>
					{isPriorityMenuOpen && (
						<div className="pointer-events-auto absolute left-0 top-full z-120 mt-2 min-w-[170px] rounded-md border border-border bg-background shadow-lg">
							<div className="py-1" role="listbox">
								{priorityOptions.map((priority) => (
									<button
										key={priority}
										type="button"
										onClick={() => {
											if (priority !== (todo.priority ?? "none")) {
												onPriorityChange(priority);
											}
											setIsPriorityMenuOpen(false);
										}}
										className={cn(
											"flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
											priority === (todo.priority ?? "none")
												? "bg-muted/60 text-foreground"
												: "text-foreground hover:bg-muted/70",
										)}
										role="option"
										aria-selected={priority === (todo.priority ?? "none")}
									>
										<span className={getPriorityClassNames(priority)}>
											<Flag
												className="h-3.5 w-3.5"
												fill="currentColor"
												aria-hidden
											/>
											{getPriorityLabel(priority, tCommon)}
										</span>
										{priority === (todo.priority ?? "none") && (
											<span className="text-[11px] text-primary">
												{tTodoDetail("current")}
											</span>
										)}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="relative flex items-center">
					<button
						ref={scheduleButtonRef}
						type="button"
						onClick={() => setIsDatePickerOpen((prev) => !prev)}
						className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs transition-colors hover:border-border hover:bg-muted/40"
						aria-expanded={isDatePickerOpen}
						aria-haspopup="dialog"
					>
						<Calendar className="h-3 w-3" />
						<span className="truncate">{scheduleSummary}</span>
					</button>
					{isDatePickerOpen && (
						<DatePickerPopover
							anchorRef={scheduleButtonRef}
							startTime={todo.startTime}
							endTime={todo.endTime}
							timeZone={todo.timeZone}
							isAllDay={todo.isAllDay}
							reminderOffsets={todo.reminderOffsets}
							rrule={todo.rrule}
							onSave={(input) => onScheduleChange(input)}
							onClose={() => setIsDatePickerOpen(false)}
						/>
					)}
				</div>

				<div className="relative flex items-center" ref={tagMenuRef}>
					<button
						type="button"
						onClick={() => setIsEditingTags((prev) => !prev)}
						className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs transition-colors hover:border-border hover:bg-muted/40"
						aria-expanded={isEditingTags}
						aria-haspopup="listbox"
					>
						<TagIcon className="h-3 w-3" />
						<span className="truncate">
							{currentTags.length > 0
								? currentTags.join(", ")
								: tTodoDetail("addTags")}
						</span>
					</button>
					{isEditingTags && (
						<div className="pointer-events-auto absolute left-0 top-full z-120 mt-2 w-56 rounded-md border border-border bg-background shadow-lg">
							{/* 顶部输入框：回车提交新标签 */}
							<div className="border-b border-border/40 p-2">
								<input
									type="text"
									value={tagInput}
									onChange={(e) => setTagInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											addTagFromInput();
										}
									}}
									placeholder={tTodoDetail("tagInputPlaceholder")}
									className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
								/>
							</div>
							{/* 已有标签列表：点击勾选/取消 */}
							<div className="max-h-48 overflow-y-auto py-1" role="listbox">
								{allTags.length === 0 && (
									<div className="px-3 py-2 text-xs text-muted-foreground">
										{tTodoDetail("noTags")}
									</div>
								)}
								{allTags.map((tag) => {
									const selected = currentTags.includes(tag);
									return (
										<button
											key={tag}
											type="button"
											onClick={() => toggleTag(tag)}
											role="option"
											aria-selected={selected}
											className={cn(
												"flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors",
												selected
													? "bg-primary/10 text-primary"
													: "text-foreground hover:bg-muted/70",
											)}
										>
											<span className="flex items-center gap-1.5 truncate">
												<TagIcon className="h-3 w-3 shrink-0" />
												<span className="truncate">{tag}</span>
											</span>
											{selected && <Check className="h-3 w-3 shrink-0" />}
										</button>
									);
								})}
							</div>
						</div>
					)}
				</div>

			</div>
		</div>
	);
}
