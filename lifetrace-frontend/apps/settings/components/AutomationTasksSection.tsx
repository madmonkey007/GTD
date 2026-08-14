"use client";

import { ChevronDown, Clock, Play, Plus, Power, Trash2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
	useAutomationTasks,
	useCreateAutomationTask,
	useDeleteAutomationTask,
	useRunAutomationTask,
	useToggleAutomationTask,
} from "@/lib/query";
import { toastError, toastSuccess } from "@/lib/toast";
import type { AutomationSchedule, AutomationScheduleType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "./SegmentedControl";
import { SettingsSection } from "./SettingsSection";
import { ToggleSwitch } from "./ToggleSwitch";

interface AutomationTasksSectionProps {
	loading?: boolean;
}

/** 表单输入框统一样式（含 focus 视觉反馈） */
const inputCls =
	"h-9 w-full rounded-md border border-border bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AutomationTasksSection({
	loading = false,
}: AutomationTasksSectionProps) {
	const t = useTranslations("automationTasks");
	const { data, isLoading } = useAutomationTasks();
	const createMutation = useCreateAutomationTask();
	const deleteMutation = useDeleteAutomationTask();
	const runMutation = useRunAutomationTask();
	const toggleMutation = useToggleAutomationTask();

	const [formOpen, setFormOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [url, setUrl] = useState("");
	const [method, setMethod] = useState("GET");
	const [scheduleType, setScheduleType] =
		useState<AutomationScheduleType>("interval");
	const [intervalMinutes, setIntervalMinutes] = useState(30);
	const [cronExpr, setCronExpr] = useState("0 9 * * *");
	const [runAt, setRunAt] = useState("");
	const [enabled, setEnabled] = useState(true);

	const tasks = data?.tasks ?? [];
	const busy =
		loading ||
		isLoading ||
		createMutation.isPending ||
		deleteMutation.isPending ||
		runMutation.isPending ||
		toggleMutation.isPending;

	const scheduleSummary = (task: {
		schedule: {
			type: AutomationScheduleType;
			intervalSeconds?: number;
			cron?: string;
			runAt?: string;
		};
	}) => {
		const schedule = task.schedule;
		if (schedule.type === "interval") {
			const minutes = Math.max(
				1,
				Math.round((schedule.intervalSeconds ?? 60) / 60),
			);
			return t("scheduleSummary.interval", { minutes });
		}
		if (schedule.type === "cron") {
			return t("scheduleSummary.cron", { cron: schedule.cron ?? "-" });
		}
		if (schedule.type === "once") {
			const label = schedule.runAt
				? new Date(schedule.runAt).toLocaleString(t("dateLocale"))
				: "-";
			return t("scheduleSummary.once", { time: label });
		}
		return "-";
	};

	const lastRunLabel = (value?: string) => {
		if (!value) return t("status.never");
		return new Date(value).toLocaleString(t("dateLocale"));
	};

	const schedulePayload = useMemo<AutomationSchedule>(() => {
		if (scheduleType === "interval") {
			return {
				type: "interval",
				intervalSeconds: intervalMinutes * 60,
			};
		}
		if (scheduleType === "cron") {
			return { type: "cron", cron: cronExpr };
		}
		const runAtIso = runAt ? new Date(runAt).toISOString() : undefined;
		return { type: "once", runAt: runAtIso };
	}, [cronExpr, intervalMinutes, runAt, scheduleType]);

	const handleCreate = async () => {
		if (!name.trim()) {
			toastError(t("errors.nameRequired"));
			return;
		}
		if (!url.trim()) {
			toastError(t("errors.urlRequired"));
			return;
		}
		if (scheduleType === "interval" && intervalMinutes <= 0) {
			toastError(t("errors.intervalRequired"));
			return;
		}
		if (scheduleType === "cron" && !cronExpr.trim()) {
			toastError(t("errors.cronRequired"));
			return;
		}
		if (scheduleType === "once" && !runAt) {
			toastError(t("errors.runAtRequired"));
			return;
		}
		try {
			await createMutation.mutateAsync({
				name: name.trim(),
				description: description.trim() || undefined,
				enabled,
				schedule: schedulePayload,
				action: {
					type: "web_fetch",
					payload: {
						url: url.trim(),
						method,
					},
				},
			});
			toastSuccess(t("messages.created"));
			setFormOpen(false);
			setName("");
			setDescription("");
			setUrl("");
			setMethod("GET");
			setScheduleType("interval");
			setIntervalMinutes(30);
			setCronExpr("0 9 * * *");
			setRunAt("");
			setEnabled(true);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("errors.createFailed", { error: msg }));
		}
	};

	const handleRun = async (id: number) => {
		try {
			await runMutation.mutateAsync(id);
			toastSuccess(t("messages.ran"));
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("errors.runFailed", { error: msg }));
		}
	};

	const handleToggle = async (id: number, nextEnabled: boolean) => {
		try {
			await toggleMutation.mutateAsync({ id, enabled: nextEnabled });
			toastSuccess(
				nextEnabled ? t("messages.enabled") : t("messages.disabled"),
			);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("errors.updateFailed", { error: msg }));
		}
	};

	const handleDelete = async (id: number) => {
		if (!window.confirm(t("confirmDelete"))) {
			return;
		}
		try {
			await deleteMutation.mutateAsync(id);
			toastSuccess(t("messages.deleted"));
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("errors.deleteFailed", { error: msg }));
		}
	};

	const scheduleOptions: { value: AutomationScheduleType; label: string }[] = [
		{ value: "interval", label: t("scheduleType.interval") },
		{ value: "cron", label: t("scheduleType.cron") },
		{ value: "once", label: t("scheduleType.once") },
	];

	return (
		<SettingsSection title={t("title")} description={t("description")}>
			<div className="space-y-4">
				{/* 新建任务：默认折叠，点击展开表单 */}
				<button
					type="button"
					onClick={() => setFormOpen((prev) => !prev)}
					aria-expanded={formOpen}
					className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
				>
					<span className="flex items-center gap-2">
						<Plus className="h-4 w-4 text-muted-foreground" />
						<span className="font-medium text-foreground">
							{t("createTitle")}
						</span>
					</span>
					<span className="flex items-center gap-2">
						<span className="hidden text-xs text-muted-foreground sm:inline">
							{t("createHint")}
						</span>
						<ChevronDown
							className={cn(
								"h-4 w-4 text-muted-foreground transition-transform",
								formOpen && "rotate-180",
							)}
						/>
					</span>
				</button>

				{/* 创建表单 */}
				{formOpen && (
					<div className="space-y-3">
						<div className="grid gap-3 md:grid-cols-2">
							<div className="space-y-1.5">
								<label
									htmlFor="automation-task-name"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.name")}
								</label>
								<input
									id="automation-task-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									placeholder={t("placeholders.name")}
									className={inputCls}
								/>
							</div>
							<div className="space-y-1.5">
								<label
									htmlFor="automation-task-url"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.url")}
								</label>
								<input
									id="automation-task-url"
									value={url}
									onChange={(event) => setUrl(event.target.value)}
									placeholder="https://"
									className={inputCls}
								/>
							</div>
							<div className="space-y-1.5 md:col-span-2">
								<label
									htmlFor="automation-task-description"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.description")}
								</label>
								<input
									id="automation-task-description"
									value={description}
									onChange={(event) => setDescription(event.target.value)}
									placeholder={t("placeholders.description")}
									className={inputCls}
								/>
							</div>
							<div className="space-y-1.5">
								<label
									htmlFor="automation-task-method"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.method")}
								</label>
								<select
									id="automation-task-method"
									value={method}
									onChange={(event) => setMethod(event.target.value)}
									className={inputCls}
								>
									<option value="GET">GET</option>
									<option value="POST">POST</option>
								</select>
							</div>
							<div className="space-y-1.5">
								<label
									htmlFor="automation-task-enabled"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.enabled")}
								</label>
								<div className="flex h-9 items-center">
									<ToggleSwitch
										id="automation-task-enabled"
										enabled={enabled}
										onToggle={setEnabled}
										ariaLabel={t("labels.enabled")}
									/>
								</div>
							</div>
						</div>

						{/* 调度类型 */}
						<div className="flex flex-wrap items-center justify-between gap-3">
							<span className="text-sm font-medium text-foreground">
								{t("labels.scheduleType")}
							</span>
							<SegmentedControl
								options={scheduleOptions}
								value={scheduleType}
								onChange={setScheduleType}
								ariaLabel={t("labels.scheduleType")}
							/>
						</div>

						{/* 按调度类型的条件字段 */}
						{scheduleType === "interval" && (
							<div className="space-y-1.5 sm:max-w-xs">
								<label
									htmlFor="automation-task-interval"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.intervalMinutes")}
								</label>
								<input
									id="automation-task-interval"
									type="number"
									min={1}
									value={intervalMinutes}
									onChange={(event) =>
										setIntervalMinutes(
											Math.max(1, Number.parseInt(event.target.value, 10) || 1),
										)
									}
									className={inputCls}
								/>
							</div>
						)}
						{scheduleType === "cron" && (
							<div className="space-y-1.5 sm:max-w-xs">
								<label
									htmlFor="automation-task-cron"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.cron")}
								</label>
								<input
									id="automation-task-cron"
									value={cronExpr}
									onChange={(event) => setCronExpr(event.target.value)}
									placeholder="0 9 * * *"
									className={inputCls}
								/>
							</div>
						)}
						{scheduleType === "once" && (
							<div className="space-y-1.5 sm:max-w-xs">
								<label
									htmlFor="automation-task-run-at"
									className="block text-sm font-medium text-foreground"
								>
									{t("labels.runAt")}
								</label>
								<input
									id="automation-task-run-at"
									type="datetime-local"
									value={runAt}
									onChange={(event) => setRunAt(event.target.value)}
									className={inputCls}
								/>
							</div>
						)}

						<div className="flex justify-end pt-1">
							<button
								type="button"
								onClick={handleCreate}
								disabled={busy}
								className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Plus className="h-4 w-4" />
								{t("actions.create")}
							</button>
						</div>
					</div>
				)}

				{/* 任务列表 */}
				<div className="space-y-2">
					{tasks.length === 0 && !isLoading && (
						<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
							<Zap className="h-5 w-5 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">{t("empty")}</p>
							<button
								type="button"
								onClick={() => setFormOpen(true)}
								className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
							>
								<Plus className="h-3.5 w-3.5" />
								{t("actions.create")}
							</button>
						</div>
					)}

					{tasks.map((task) => (
						<div
							key={task.id}
							className="rounded-lg border border-border bg-background/70 px-3 py-3"
						>
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-foreground">
										{task.name}
									</p>
									{task.description && (
										<p className="truncate text-xs text-muted-foreground">
											{task.description}
										</p>
									)}
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									<button
										type="button"
										onClick={() => handleRun(task.id)}
										disabled={busy}
										className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Play className="h-3.5 w-3.5" />
										{t("actions.run")}
									</button>
									<button
										type="button"
										onClick={() => handleToggle(task.id, !task.enabled)}
										disabled={busy}
										aria-pressed={task.enabled}
										aria-label={
											task.enabled
												? t("actions.disable")
												: t("actions.enable")
										}
										title={
											task.enabled
												? t("actions.disable")
												: t("actions.enable")
										}
										className={cn(
											"inline-flex h-8 w-8 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
											task.enabled
												? "border-primary/40 bg-primary/10 text-primary"
												: "border-border text-muted-foreground hover:bg-muted/60",
										)}
									>
										<Power className="h-4 w-4" />
									</button>
									<button
										type="button"
										onClick={() => handleDelete(task.id)}
										disabled={busy}
										aria-label={t("actions.delete")}
										title={t("actions.delete")}
										className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Trash2 className="h-4 w-4" />
									</button>
								</div>
							</div>
							<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
								<span className="inline-flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{scheduleSummary(task)}
								</span>
								<span>
									{t("labels.lastRun", { time: lastRunLabel(task.lastRunAt) })}
								</span>
								<span
									className={cn(
										"inline-flex items-center gap-1.5",
										task.lastStatus === "error" &&
											"text-destructive",
										task.lastStatus === "success" &&
											"text-emerald-600 dark:text-emerald-400",
									)}
								>
									<span
										className={cn(
											"h-1.5 w-1.5 rounded-full",
											task.lastStatus === "error"
												? "bg-destructive"
												: task.lastStatus === "success"
													? "bg-emerald-500"
													: "bg-muted-foreground/40",
										)}
									/>
									{t("labels.status")}:{" "}
									{task.lastStatus
										? t(`status.${task.lastStatus}`)
										: t("status.never")}
								</span>
							</div>
							{task.lastError && (
								<p className="mt-2 text-xs text-destructive">
									{task.lastError}
								</p>
							)}
							{task.lastOutput && (
								<p className="mt-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground line-clamp-2">
									{task.lastOutput}
								</p>
							)}
						</div>
					))}
				</div>
			</div>
		</SettingsSection>
	);
}
