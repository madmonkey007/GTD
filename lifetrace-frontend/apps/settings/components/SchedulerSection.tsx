"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Edit2, Pause, Play, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { unwrapApiData } from "@/lib/api/fetcher";
import {
	getGetAllJobsApiSchedulerJobsGetQueryKey,
	getGetSchedulerStatusApiSchedulerStatusGetQueryKey,
	useGetAllJobsApiSchedulerJobsGet,
	useGetSchedulerStatusApiSchedulerStatusGet,
	usePauseAllJobsApiSchedulerJobsPauseAllPost,
	usePauseJobApiSchedulerJobsJobIdPausePost,
	useResumeAllJobsApiSchedulerJobsResumeAllPost,
	useResumeJobApiSchedulerJobsJobIdResumePost,
	useUpdateJobIntervalApiSchedulerJobsJobIdIntervalPut,
} from "@/lib/generated/scheduler/scheduler";
import type { JobInfo, JobListResponse } from "@/lib/generated/schemas";
import { toastError, toastSuccess } from "@/lib/toast";
import { SettingsSection } from "./SettingsSection";

const LEGACY_JOB_IDS = ["task_context_mapper_job", "task_summary_job"];

interface SchedulerSectionProps {
	loading?: boolean;
}

export function SchedulerSection({ loading = false }: SchedulerSectionProps) {
	const t = useTranslations("scheduler");
	const queryClient = useQueryClient();
	const [editingJobId, setEditingJobId] = useState<string | null>(null);
	const [editInterval, setEditInterval] = useState({
		hours: 0,
		minutes: 0,
		seconds: 0,
	});
	const [showLegacy, setShowLegacy] = useState(false);

	const { data: jobsData, isLoading: jobsLoading } =
		useGetAllJobsApiSchedulerJobsGet({
			query: { refetchInterval: 10000 },
		});

	const { data: statusData, isLoading: statusLoading } =
		useGetSchedulerStatusApiSchedulerStatusGet({
			query: { refetchInterval: 10000 },
		});

	const pauseJobMutation = usePauseJobApiSchedulerJobsJobIdPausePost();
	const resumeJobMutation = useResumeJobApiSchedulerJobsJobIdResumePost();
	const pauseAllMutation = usePauseAllJobsApiSchedulerJobsPauseAllPost();
	const resumeAllMutation = useResumeAllJobsApiSchedulerJobsResumeAllPost();
	const updateIntervalMutation =
		useUpdateJobIntervalApiSchedulerJobsJobIdIntervalPut();

	const isLoading =
		loading ||
		jobsLoading ||
		statusLoading ||
		pauseJobMutation.isPending ||
		resumeJobMutation.isPending ||
		pauseAllMutation.isPending ||
		resumeAllMutation.isPending ||
		updateIntervalMutation.isPending;

	const handleRefresh = () => {
		queryClient.invalidateQueries({
			queryKey: getGetAllJobsApiSchedulerJobsGetQueryKey(),
		});
		queryClient.invalidateQueries({
			queryKey: getGetSchedulerStatusApiSchedulerStatusGetQueryKey(),
		});
	};

	const handlePauseJob = async (jobId: string) => {
		try {
			await pauseJobMutation.mutateAsync({ jobId });
			toastSuccess(t("jobPaused", { job: getJobName(jobId) }));
			handleRefresh();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("pauseFailed", { error: msg }));
		}
	};

	const handleResumeJob = async (jobId: string) => {
		try {
			await resumeJobMutation.mutateAsync({ jobId });
			toastSuccess(t("jobResumed", { job: getJobName(jobId) }));
			handleRefresh();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("resumeFailed", { error: msg }));
		}
	};

	const handlePauseAll = async () => {
		try {
			await pauseAllMutation.mutateAsync();
			toastSuccess(t("allJobsPaused"));
			handleRefresh();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("pauseFailed", { error: msg }));
		}
	};

	const handleResumeAll = async () => {
		try {
			await resumeAllMutation.mutateAsync();
			toastSuccess(t("allJobsResumed"));
			handleRefresh();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("resumeFailed", { error: msg }));
		}
	};

	const handleStartEditInterval = (jobId: string, trigger: string) => {
		const parsed = parseIntervalToNumbers(trigger);
		setEditInterval(parsed);
		setEditingJobId(jobId);
	};

	const handleCancelEdit = () => {
		setEditingJobId(null);
		setEditInterval({ hours: 0, minutes: 0, seconds: 0 });
	};

	const handleSaveInterval = async (jobId: string) => {
		const { hours, minutes, seconds } = editInterval;
		if (hours === 0 && minutes === 0 && seconds === 0) {
			toastError(t("intervalCannotBeZero"));
			return;
		}
		try {
			await updateIntervalMutation.mutateAsync({
				jobId,
				data: {
					job_id: jobId,
					hours: hours > 0 ? hours : undefined,
					minutes: minutes > 0 ? minutes : undefined,
					seconds: seconds > 0 ? seconds : undefined,
				},
			});
			toastSuccess(t("intervalUpdated", { job: getJobName(jobId) }));
			handleCancelEdit();
			handleRefresh();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			toastError(t("updateFailed", { error: msg }));
		}
	};

	const getJobName = (jobId: string) => {
		try {
			return t(`jobs.${jobId}` as Parameters<typeof t>[0]);
		} catch {
			return jobId;
		}
	};

	const getJobDescription = (jobId: string) => {
		try {
			return t(`jobDescriptions.${jobId}` as Parameters<typeof t>[0]);
		} catch {
			return "";
		}
	};

	const isLegacyJob = (jobId: string) => LEGACY_JOB_IDS.includes(jobId);

	const formatNextRunTime = (nextRunTime: string | null) => {
		if (!nextRunTime) return t("paused");
		const dateLocale = t("dateLocale");
		const date = new Date(nextRunTime);
		return date.toLocaleString(dateLocale, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	const parseInterval = (trigger: string) => {
		const match = trigger.match(/interval\[(\d+):(\d+):(\d+)\]/);
		if (match) {
			const hours = parseInt(match[1], 10);
			const minutes = parseInt(match[2], 10);
			const seconds = parseInt(match[3], 10);
			const parts: string[] = [];
			if (hours > 0) parts.push(`${hours}${t("hour")}`);
			if (minutes > 0) parts.push(`${minutes}${t("minute")}`);
			if (seconds > 0) parts.push(`${seconds}${t("second")}`);
			return parts.join(" ") || trigger;
		}
		return trigger;
	};

	const parseIntervalToNumbers = (trigger: string) => {
		const match = trigger.match(/interval\[(\d+):(\d+):(\d+)\]/);
		if (match) {
			return {
				hours: parseInt(match[1], 10),
				minutes: parseInt(match[2], 10),
				seconds: parseInt(match[3], 10),
			};
		}
		return { hours: 0, minutes: 0, seconds: 10 };
	};

	const status = unwrapApiData<{
		running?: boolean;
		totalJobs?: number;
		runningJobs?: number;
		pausedJobs?: number;
	}>(statusData);
	const jobsResponse = unwrapApiData<JobListResponse>(jobsData);
	const allJobs = jobsResponse?.jobs || [];
	const activeJobs = allJobs.filter((job) => !isLegacyJob(job.id));
	const legacyJobs = allJobs.filter((job) => isLegacyJob(job.id));

	const renderJobItem = (job: JobInfo, isLegacy = false) => {
		const isRunning = job.pending ?? false;
		const isEditing = editingJobId === job.id;

		return (
			<div
				key={job.id}
				className={`group rounded-xl border px-4 py-3 transition-colors ${
					isLegacy
						? "border-border/30 bg-muted/15 opacity-60"
						: "border-border/40 bg-card/40 hover:border-border/60 hover:bg-card/60"
				}`}
			>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3 min-w-0 flex-1">
						<span
							className={`h-2 w-2 rounded-full shrink-0 ${
								isRunning
									? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]"
									: "bg-amber-400"
							}`}
							title={isRunning ? t("running") : t("paused")}
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<p className="text-[13px] font-medium text-foreground/90 truncate">
									{getJobName(job.id)}
								</p>
								{isLegacy && (
									<span className="shrink-0 rounded-md bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/25 dark:text-amber-400">
										Legacy
									</span>
								)}
							</div>
							<p className="mt-0.5 text-xs text-muted-foreground/60 truncate">
								{getJobDescription(job.id)}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() =>
							isRunning ? handlePauseJob(job.id) : handleResumeJob(job.id)
						}
						disabled={isLoading}
						className={`shrink-0 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all disabled:opacity-50 ${
							isRunning
								? "bg-amber-100/80 text-amber-700 hover:bg-amber-200/80 dark:bg-amber-900/20 dark:text-amber-400"
								: "bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200/80 dark:bg-emerald-900/20 dark:text-emerald-400"
						}`}
					>
						{isRunning ? (
							<>
								<Pause className="h-3 w-3" />
								{t("pause")}
							</>
						) : (
							<>
								<Play className="h-3 w-3" />
								{t("resume")}
							</>
						)}
					</button>
				</div>

				<div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground/60">
					<Clock className="h-3 w-3 shrink-0" />
					{isEditing ? (
						<div className="flex flex-wrap items-center gap-1.5">
							{(["hours", "minutes", "seconds"] as const).map((unit, idx) => (
								<div key={unit} className="flex items-center gap-1">
									{idx > 0 && <span className="text-muted-foreground/30">:</span>}
									<input
										type="number"
										min="0"
										max={unit === "hours" ? 23 : 59}
										value={editInterval[unit]}
										onChange={(e) =>
											setEditInterval((prev) => ({
												...prev,
												[unit]: parseInt(e.target.value, 10) || 0,
											}))
										}
										className="min-h-[36px] w-12 rounded-md border border-border/50 bg-background/50 px-1.5 py-1 text-center text-[12px] tabular-nums focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/15"
									/>
									<span className="text-[10px] text-muted-foreground/40">
										{unit === "hours" ? t("hour") : unit === "minutes" ? t("minute") : t("second")}
									</span>
								</div>
							))}
							<div className="ml-1 flex items-center gap-1">
								<button
									type="button"
									onClick={() => handleSaveInterval(job.id)}
									disabled={isLoading}
									className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-100/50 dark:text-emerald-400"
									title={t("save")}
								>
									<Check className="h-4 w-4" />
								</button>
								<button
									type="button"
									onClick={handleCancelEdit}
									className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-100/50 dark:text-red-400"
									title={t("cancel")}
								>
									<X className="h-4 w-4" />
								</button>
							</div>
						</div>
					) : (
						<div className="flex flex-wrap items-center gap-2">
							<span className="tabular-nums">
								{t("interval")}: {parseInterval(job.trigger)}
							</span>
							<button
								type="button"
								onClick={() => handleStartEditInterval(job.id, job.trigger)}
								disabled={isLoading}
								className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-muted-foreground/70"
								title={t("editInterval")}
							>
								<Edit2 className="h-3.5 w-3.5" />
							</button>
							<span className="text-muted-foreground/20">&middot;</span>
							<span className="tabular-nums">
								{t("next")}: {formatNextRunTime(job.next_run_time ?? null)}
							</span>
						</div>
					)}
				</div>
			</div>
		);
	};

	return (
		<SettingsSection title={t("title")} description={t("description")}>
			<div className="space-y-3">
				{/* Status bar */}
				<div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4 text-[13px] text-muted-foreground/70">
						<span className="flex items-center gap-1.5">
							<span
								className={`h-1.5 w-1.5 rounded-full ${
									status?.running ? "bg-emerald-500" : "bg-red-400"
								}`}
							/>
							{status?.running ? t("schedulerRunning") : t("schedulerStopped")}
						</span>
						<span className="tabular-nums">
							{t("runningCount", {
								running: status?.runningJobs || 0,
								paused: status?.pausedJobs || 0,
							})}
						</span>
					</div>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={handleRefresh}
							disabled={isLoading}
							className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-border/50 bg-background/50 p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground/70 disabled:opacity-50"
							title={t("refresh")}
						>
							<RefreshCw
								className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
							/>
						</button>
						<button
							type="button"
							onClick={handlePauseAll}
							disabled={isLoading}
							className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground/70 disabled:opacity-50"
						>
							<Pause className="h-3.5 w-3.5" />
							{t("pauseAll")}
						</button>
						<button
							type="button"
							onClick={handleResumeAll}
							disabled={isLoading}
							className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground/70 disabled:opacity-50"
						>
							<Play className="h-3.5 w-3.5" />
							{t("resumeAll")}
						</button>
					</div>
				</div>

				{/* Active jobs */}
				<div className="space-y-2">
					{activeJobs.map((job) => renderJobItem(job))}

					{activeJobs.length === 0 && !jobsLoading && (
						<div className="py-6 text-center text-[13px] text-muted-foreground/50">
							{t("noJobs")}
						</div>
					)}

					{jobsLoading && (
						<div className="py-6 text-center text-[13px] text-muted-foreground/50">
							{t("loading")}
						</div>
					)}
				</div>

				{/* Legacy section */}
				{legacyJobs.length > 0 && (
					<div className="pt-3 border-t border-border/30">
						<button
							type="button"
							onClick={() => setShowLegacy(!showLegacy)}
							className="flex items-center gap-2 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground/70"
						>
							<span
								className={`inline-block text-[10px] transition-transform ${
									showLegacy ? "rotate-90" : ""
								}`}
							>
								&#9654;
							</span>
							{t("legacyJobs")} ({legacyJobs.length})
							<span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/40">
								{t("legacyNotNeeded")}
							</span>
						</button>

						{showLegacy && (
							<div className="mt-2 space-y-2">
								{legacyJobs.map((job) => renderJobItem(job, true))}
							</div>
						)}
					</div>
				)}
			</div>
		</SettingsSection>
	);
}
