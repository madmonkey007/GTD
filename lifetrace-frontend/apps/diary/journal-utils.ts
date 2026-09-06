import type { JournalRefreshMode } from "@/lib/store/journal-store";

const pad = (value: number) => value.toString().padStart(2, "0");

export const formatDateInput = (value: Date) => {
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

export const parseDateInput = (value: string) => {
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return new Date();
	return new Date(year, month - 1, day);
};

export const parseJournalDate = (value: string) => {
	const datePart = value.split("T")[0] ?? value;
	return parseDateInput(datePart);
};

export const normalizeDateOnly = (value: Date) =>
	new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const toggleCalendarDate = (current: Date | null, clicked: Date) => {
	if (current && formatDateInput(current) === formatDateInput(clicked)) return null;
	return normalizeDateOnly(clicked);
};

export const getDayRange = (value: Date) => {
	const start = new Date(
		value.getFullYear(),
		value.getMonth(),
		value.getDate(),
		0,
		0,
		0,
		0,
	);
	const end = new Date(
		value.getFullYear(),
		value.getMonth(),
		value.getDate(),
		23,
		59,
		59,
		999,
	);
	return { start, end };
};

export const getLocalDayApiRange = (value: Date) => {
	const dateKey = formatDateInput(value);
	return {
		startDate: `${dateKey}T00:00:00.000`,
		endDate: `${dateKey}T23:59:59.999`,
	};
};

/**
 * 序列化为「无时区后缀的本地墙上时间」。后端 journals.date 存 naive 本地时间
 * （建库语义：本地墙钟），带 Z 的 ISO 会按 UTC 比较导致云端差 8 小时。
 */
export const formatLocalDateTime = (value: Date) =>
	`${formatDateInput(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${value.getMilliseconds().toString().padStart(3, "0")}`;

export const getLocalRangeApi = (start: Date, end: Date) => ({
	startDate: formatLocalDateTime(getDayRange(start).start),
	endDate: formatLocalDateTime(getDayRange(end).end),
});

/** 周一为一周起点（与国内日历一致），返回该日期所在周的周一 00:00 */
export const getWeekStart = (value: Date) => {
	const day = value.getDay();
	const back = (day + 6) % 7;
	return new Date(value.getFullYear(), value.getMonth(), value.getDate() - back);
};

export interface HeatmapWeek {
	/** 周一 00:00，作为列 key */
	weekStart: Date;
	/** 按周一→周日排列的 7 格；未来日期为 null（渲染占位空格） */
	days: (Date | null)[];
}

/** 把连续日期按自然周分列（周一为列首）；未来日期不在输入里，由调用方渲染占位 */
export const groupDatesByWeek = (dates: Date[]): HeatmapWeek[] => {
	const byWeek = new Map<string, Date[]>();
	for (const date of dates) {
		const key = formatDateInput(getWeekStart(date));
		const bucket = byWeek.get(key);
		if (bucket) bucket.push(date);
		else byWeek.set(key, [date]);
	}
	return [...byWeek.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([key, days]) => {
			const [y, m, d] = key.split("-").map(Number);
			const weekStart = new Date(y, m - 1, d);
			const filled: (Date | null)[] = Array.from({ length: 7 }, () => null);
			for (const date of days) {
				const back = ((date.getDay() + 6) % 7);
				filled[back] = date;
			}
			return { weekStart, days: filled };
		});
};

/**
 * 月份标签：放在「包含当月 1 号」的那一列，保证标签与日历列对齐；
 * 只保留最后 limit 个标签。
 */
export const getMonthLabelColumns = (
	weeks: HeatmapWeek[],
	limit = 3,
): { label: string; index: number }[] => {
	const labels: { label: string; index: number }[] = [];
	weeks.forEach((week, index) => {
		const firstOfMonth = week.days.find((day) => day?.getDate() === 1);
		if (firstOfMonth) {
			labels.push({ label: `${firstOfMonth.getMonth() + 1}月`, index });
		}
	});
	return labels.slice(-limit);
};

const parseTimeString = (value: string) => {
	const [hours = "0", minutes = "0"] = value.split(":");
	return {
		hours: Number(hours),
		minutes: Number(minutes),
	};
};

export const resolveBucketRange = (
	reference: Date,
	mode: JournalRefreshMode,
	fixedTime: string,
	workHoursEnd: string,
	customTime: string,
) => {
	const timeSource =
		mode === "workHours"
			? workHoursEnd
			: mode === "custom"
				? customTime
				: fixedTime;
	const { hours, minutes } = parseTimeString(timeSource);

	const bucketStart = new Date(reference);
	bucketStart.setHours(hours, minutes, 0, 0);
	if (reference < bucketStart) {
		bucketStart.setDate(bucketStart.getDate() - 1);
	}

	const bucketEnd = new Date(bucketStart);
	bucketEnd.setDate(bucketEnd.getDate() + 1);

	return { bucketStart, bucketEnd, bucketTime: timeSource };
};
