"use client";

/**
 * GTD 整理收集箱（Chat 面板版）：
 * 对收集箱中的每个父待办逐条过 5 个问题，以对话消息 + 可点选回答气泡的形式
 * 呈现在 Chat 面板内，处理完一条自动进入下一条，直到收集箱清空。
 * "清单"即项目（Project）：待办加入项目后由后端自动移出收集箱（is_inbox=False）。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
	CalendarClock,
	FolderKanban,
	Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/store/locale";
import { useProcessInboxStore } from "@/lib/store/process-inbox-store";
import { useTodoStore } from "@/lib/store/todo-store";
import { useUiStore } from "@/lib/store/ui-store";
import { useTodoMutations, useTodos } from "@/lib/query/todos";
import {
	useJournalMutations,
	useProjectMutations,
	useProjects,
} from "@/lib/query";
import { queryKeys } from "@/lib/query/keys";
import type { ProjectView } from "@/lib/query/projects";
import { BreakdownQuestionnaireModal } from "@/apps/chat/components/breakdown/BreakdownQuestionnaireModal";
import type { Question } from "@/lib/store/breakdown-store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** GTD 系统清单（项目）名称：不存在时自动创建 */
const SOMEDAY_LIST = "可能清单";
const WAITING_LIST = "等待清单";
const NEXT_LIST = "执行清单";

interface ChatTurn {
	id: number;
	role: "assistant" | "user";
	text: string;
}

/** 气泡：assistant 靠左、user 靠右（与 chat 消息布局一致） */
function Bubble({ turn }: { turn: ChatTurn }) {
	return (
		<div
			className={cn(
				"flex w-full",
				turn.role === "user" ? "justify-end" : "justify-start",
			)}
		>
			<div
				className={cn(
					"max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
					turn.role === "user"
						? "rounded-br-md bg-primary text-primary-foreground"
						: "rounded-bl-md bg-muted text-foreground",
				)}
			>
				{turn.text}
			</div>
		</div>
	);
}

export function ProcessInboxChat() {
	const active = useProcessInboxStore((s) => s.active);
	const sessionId = useProcessInboxStore((s) => s.sessionId);
	const stop = useProcessInboxStore((s) => s.stop);
	const { locale } = useLocaleStore();
	const zh = locale === "zh";

	const queryClient = useQueryClient();
	const { data: todos = [] } = useTodos();
	const { data: projects = [] } = useProjects();
	const { updateTodo, deleteTodo } = useTodoMutations();
	const { createJournal } = useJournalMutations();
	const { createProjectAsync, addTodosAsync } = useProjectMutations();
	const setSelectedTodoId = useTodoStore((s) => s.setSelectedTodoId);
	const setActiveView = useUiStore((s) => s.setActiveView);

	// 收集箱父待办：未入项目（isInbox）、无父级、未完成
	const queue = useMemo(
		() =>
			todos.filter(
				(t) =>
					(t.isInbox ?? true) &&
					(t.parentTodoId === null || t.parentTodoId === undefined) &&
					t.status !== "completed",
			),
		[todos],
	);

	// 已处理完的待办 id（而非下标：任务被移出收集箱后队列会缩短，下标会跳条）
	const [processedIds, setProcessedIds] = useState<number[]>([]);
	const [step, setStep] = useState(1);
	const [turns, setTurns] = useState<ChatTurn[]>([]);
	const [busy, setBusy] = useState(false);
	const [projectPicker, setProjectPicker] = useState(false);
	const [newProjectName, setNewProjectName] = useState("");
	const [dueValue, setDueValue] = useState("");
	const turnIdRef = useRef(0);

	const current = queue.find((t) => !processedIds.includes(t.id));
	const done = !current;

	const pushTurn = (role: ChatTurn["role"], text: string) => {
		turnIdRef.current += 1;
		setTurns((t) => [...t, { id: turnIdRef.current, role, text }]);
	};

	// 会话启动 / 重启：清空历史并抛出第一条
	useEffect(() => {
		setProcessedIds([]);
		setStep(1);
		setTurns([]);
		setProjectPicker(false);
		setDueValue("");
		turnIdRef.current = 0;
		if (active) {
			pushTurn(
				"assistant",
				zh
					? "开始整理收集箱 📥 我们对每条任务过 5 个 GTD 问题，一路清空它。"
					: "Let's process your inbox 📥 We'll walk each item through the 5 GTD questions.",
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionId, active]);

	// 当前待办变化时抛出「第 x/N 条」+ 第 1 问
	useEffect(() => {
		if (!active || !current) return;
		const doneCount = queue.filter((t) => processedIds.includes(t.id)).length;
		pushTurn(
			"assistant",
			zh
				? `第 ${Math.min(doneCount + 1, queue.length)} / ${queue.length} 条：\n「${current.name}」`
				: `Item ${Math.min(doneCount + 1, queue.length)} / ${queue.length}:\n"${current.name}"`,
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active, current?.id, sessionId]);

	// 全部处理完：总结
	useEffect(() => {
		if (!active || current || processedIds.length === 0) return;
		pushTurn(
			"assistant",
			zh
				? `整理完成 🎉 共处理 ${processedIds.length} 条收集箱任务。`
				: `All done 🎉 ${processedIds.length} inbox items processed.`,
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active, done, sessionId]);

	const askNext = (question: string) => pushTurn("assistant", question);

	const advance = () => {
		if (!current) return;
		const finishedId = current.id;
		setStep(1);
		setProjectPicker(false);
		setDueValue("");
		setProcessedIds((p) => [...p, finishedId]);
	};

	/** 移动到清单（项目）：已存在直接加入，不存在则先创建同名系统清单 */
	const moveToProject = async (todoId: number, projectName: string) => {
		setBusy(true);
		try {
			let project: ProjectView | undefined = projects.find(
				(p) => p.name === projectName && !p.isArchived,
			);
			if (!project) {
				project = (await createProjectAsync({ name: projectName })) ?? undefined;
				await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
			}
			if (!project) throw new Error(zh ? "清单创建失败" : "Failed to create list");
			await addTodosAsync({ id: project.id, todoIds: [todoId] });
			toast(zh ? `已移入「${projectName}」` : `Moved to "${projectName}"`);
			pushTurn("user", zh ? `移入「${projectName}」` : `Move to "${projectName}"`);
			advance();
		} catch (e) {
			console.error("[process-inbox] moveToProject failed:", e);
			toast(zh ? "移动失败，请重试" : "Move failed", { type: "warning" });
		} finally {
			setBusy(false);
		}
	};

	const handleTrash = async () => {
		if (!current) return;
		setBusy(true);
		try {
			await deleteTodo(current.id);
			toast(zh ? "已移入垃圾桶" : "Moved to trash");
			pushTurn("user", zh ? "扔进垃圾桶" : "Trash it");
			advance();
		} finally {
			setBusy(false);
		}
	};

	const handleToNote = async () => {
		if (!current) return;
		setBusy(true);
		try {
			const now = new Date();
			const pad = (n: number) => String(n).padStart(2, "0");
			await createJournal({
				name: current.name,
				user_notes: current.description || current.summary || current.name,
				date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
				content_format: "markdown",
			});
			await deleteTodo(current.id);
			toast(zh ? "已存为笔记" : "Saved as note");
			pushTurn("user", zh ? "存为笔记" : "Save as note");
			advance();
		} catch {
			toast(zh ? "存为笔记失败" : "Failed to save note", { type: "warning" });
		} finally {
			setBusy(false);
		}
	};

	const handleDoNow = () => {
		if (!current) return;
		pushTurn("user", zh ? "2 分钟能搞定，现在就做" : "2 minutes, do it now");
		stop();
		setSelectedTodoId(current.id);
		setActiveView("list");
	};

	const handleSetDue = async () => {
		if (!current || !dueValue) return;
		setBusy(true);
		try {
			await updateTodo(current.id, { due: new Date(dueValue).toISOString() });
			toast(zh ? "已安排到日程" : "Scheduled");
			pushTurn(
				"user",
				zh
					? `安排到 ${dueValue.replace("T", " ")}`
					: `Schedule at ${dueValue.replace("T", " ")}`,
			);
			advance();
		} catch {
			toast(zh ? "设置日程失败" : "Failed to schedule", { type: "warning" });
		} finally {
			setBusy(false);
		}
	};

	if (!active) return null;

	// ---- 当前问题与可选回答（复用 BreakdownQuestionnaireModal 的 Question 结构）----
	const questions: Question[] =
		!current || projectPicker
			? []
			: step === 11
				? [
						{
							id: "step11",
							question: zh ? "它去了哪里？" : "Where does it go?",
							options: [
								zh ? "垃圾桶" : "Trash",
								zh ? "可能清单" : "Someday list",
								zh ? "存为笔记" : "Save as note",
							],
						},
					]
				: step === 1
					? [
							{
								id: "step1",
								question: zh ? "1. 这件事可以行动吗？" : "1. Is it actionable?",
								options: [
									zh ? "可行动" : "Actionable",
									zh ? "不可行动" : "Not actionable",
								],
							},
						]
					: step === 2
						? [
								{
									id: "step2",
									question: zh
										? "2. 这件事可以一步搞定吗？"
										: "2. Can it be done in one step?",
									options: [
										zh ? "可以" : "Yes",
										zh ? "不可以 → 项目清单" : "No → Project list",
									],
								},
							]
						: step === 3
							? [
									{
										id: "step3",
										question: zh
											? "3. 这件事可以在 2 分钟内搞定吗？"
											: "3. Can it be done in 2 minutes?",
										options: [
											zh ? "可以，直接去做" : "Yes, do it now",
											zh ? "不可以" : "No",
										],
									},
								]
							: step === 4
								? [
										{
											id: "step4",
											question: zh ? "4. 这件事该我做吗？" : "4. Is it mine to do?",
											options: [
												zh ? "该我做" : "Mine",
												zh ? "不该我做 → 等待清单" : "Not mine → Waiting list",
											],
										},
									]
								: step === 5
									? [
											{
												id: "step5",
												question: zh
													? "5. 这件事有特定时间吗？"
													: "5. Does it have a specific time?",
												options: [
													zh ? "有 → 日历/日程" : "Yes → Calendar",
													zh ? "无 → 执行清单" : "No → Next list",
												],
											},
										]
									: [];

	/** 单选即时执行：选项文本 → 对应动作（与原 choices 一一对应） */
	const handleOptionSelect = (option: string) => {
		if (!current || step === 51) return;
		const L = (zhText: string, enText: string) => (zh ? zhText : enText);
		switch (option) {
			case L("可行动", "Actionable"):
				pushTurn("user", L("可行动", "Actionable"));
				setStep(2);
				askNext(L("2. 这件事可以一步搞定吗？", "2. Can it be done in one step?"));
				break;
			case L("不可行动", "Not actionable"):
				pushTurn("user", L("不可行动", "Not actionable"));
				setStep(11);
				askNext(L("它去了哪里？", "Where does it go?"));
				break;
			case L("可以", "Yes"):
				pushTurn("user", L("一步搞定", "One step"));
				setStep(3);
				askNext(L("3. 这件事可以在 2 分钟内搞定吗？", "3. Can it be done in 2 minutes?"));
				break;
			case L("不可以 → 项目清单", "No → Project list"):
				pushTurn("user", L("不止一步，放项目清单", "More than one step → project"));
				setProjectPicker(true);
				askNext(L("移动到哪个清单？", "Move to which list?"));
				break;
			case L("可以，直接去做", "Yes, do it now"):
				handleDoNow();
				break;
			case L("不可以", "No"):
				pushTurn("user", L("超过 2 分钟", "More than 2 min"));
				setStep(4);
				askNext(L("4. 这件事该我做吗？", "4. Is it mine to do?"));
				break;
			case L("该我做", "Mine"):
				pushTurn("user", L("该我做", "Mine"));
				setStep(5);
				askNext(L("5. 这件事有特定时间吗？", "5. Does it have a specific time?"));
				break;
			case L("不该我做 → 等待清单", "Not mine → Waiting list"):
				void moveToProject(current.id, WAITING_LIST);
				break;
			case L("有 → 日历/日程", "Yes → Calendar"):
				pushTurn("user", L("有特定时间", "Has a specific time"));
				setStep(51);
				askNext(L("安排到什么时间？", "When?"));
				break;
			case L("无 → 执行清单", "No → Next list"):
				void moveToProject(current.id, NEXT_LIST);
				break;
			case L("垃圾桶", "Trash"):
				void handleTrash();
				break;
			case L("可能清单", "Someday list"):
				void moveToProject(current.id, SOMEDAY_LIST);
				break;
			case L("存为笔记", "Save as note"):
				void handleToNote();
				break;
		}
	};

	return (
		<div className="flex flex-col gap-2.5 px-4 pb-2">
			{/* 对话记录 */}
			{turns.map((turn, i) => (
				<Bubble key={`${turn.id}-${i}`} turn={turn} />
			))}

			{/* 可选回答（提问组件） */}
			{!done && current && (
				<div className="flex flex-col gap-1.5">
					{projectPicker ? (
						<div className="space-y-1.5 rounded-2xl rounded-tl-md bg-muted/60 p-2.5">
							<div className="max-h-44 space-y-1 overflow-y-auto">
								{projects
									.filter((p) => !p.isArchived)
									.map((p) => (
										<button
											key={p.id}
											type="button"
											disabled={busy}
											onClick={() => void moveToProject(current.id, p.name)}
											className="flex w-full items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
										>
											<FolderKanban className="h-3.5 w-3.5 text-primary/60" />
											<span className="min-w-0 flex-1 truncate">{p.name}</span>
											<span className="text-[10px] text-muted-foreground/50">{p.todoCount}</span>
										</button>
									))}
							</div>
							<div className="flex items-center gap-1.5">
								<input
									value={newProjectName}
									onChange={(e) => setNewProjectName(e.target.value)}
									placeholder={zh ? "新建清单…" : "New list…"}
									className="h-8 flex-1 rounded-lg border border-border/50 bg-background px-2.5 text-sm outline-none focus:border-primary/40"
								/>
								<button
									type="button"
									disabled={busy || !newProjectName.trim()}
									onClick={() => {
										void moveToProject(current.id, newProjectName.trim()).then(() =>
											setNewProjectName(""),
										);
									}}
									className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
								>
									{zh ? "创建并移入" : "Create & move"}
								</button>
							</div>
							<button
								type="button"
								onClick={() => setProjectPicker(false)}
								className="text-xs text-muted-foreground/60 hover:text-foreground"
							>
								{zh ? "← 返回" : "← Back"}
							</button>
						</div>
					) : step === 51 ? (
						<div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-muted/60 p-2.5">
							<input
								type="datetime-local"
								value={dueValue}
								onChange={(e) => setDueValue(e.target.value)}
								className="h-8 flex-1 rounded-lg border border-border/50 bg-background px-2.5 text-sm outline-none focus:border-primary/40"
							/>
							<button
								type="button"
								disabled={busy || !dueValue}
								onClick={() => void handleSetDue()}
								className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
							>
								{busy ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<CalendarClock className="h-3.5 w-3.5" />
								)}
								{zh ? "安排" : "Schedule"}
							</button>
							<button
								type="button"
								onClick={() => setStep(5)}
								className="text-xs text-muted-foreground/60 hover:text-foreground"
							>
								{zh ? "← 返回" : "← Back"}
							</button>
						</div>
					) : (
						<BreakdownQuestionnaireModal
							questions={questions}
							answers={{}}
							onAnswerChange={() => {}}
							onSubmit={() => {}}
							isSubmitting={busy}
							onClose={stop}
							onOptionSelect={handleOptionSelect}
						/>
					)}
				</div>
			)}

			{/* 结束条 */}
			<div className="flex items-center justify-between pt-1">
				<span className="text-[10px] text-muted-foreground/50">
					{queue.length === 0
						? zh
							? "收集箱是空的"
							: "Inbox is empty"
						: `${Math.min(processedIds.length + (done ? 0 : 1), queue.length + processedIds.length)} / ${queue.length + processedIds.length}`}
				</span>
				<button
					type="button"
					onClick={stop}
					className="text-xs text-muted-foreground/60 hover:text-foreground"
				>
					{zh ? "结束整理" : "End"}
				</button>
			</div>
		</div>
	);
}
