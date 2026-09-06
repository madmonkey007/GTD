import assert from "node:assert/strict";
import test from "node:test";

import {
	formatDateInput,
	formatLocalDateTime,
	getLocalDayApiRange,
	getLocalRangeApi,
	getMonthLabelColumns,
	getWeekStart,
	groupDatesByWeek,
	toggleCalendarDate,
} from "./journal-utils.ts";

test("serializes a visible calendar day without converting it to UTC", () => {
	const range = getLocalDayApiRange(new Date(2026, 8, 6, 20, 15));

	assert.deepEqual(range, {
		startDate: "2026-09-06T00:00:00.000",
		endDate: "2026-09-06T23:59:59.999",
	});
	assert.equal(range.startDate.includes("Z"), false);
	assert.equal(/[+-]\d{2}:?\d{2}$/.test(range.endDate), false);
});

test("clicking the selected calendar day clears the filter", () => {
	const current = new Date(2026, 8, 6, 8);
	const sameDay = new Date(2026, 8, 6, 22);

	assert.equal(toggleCalendarDate(current, sameDay), null);
});

test("clicking another calendar day selects its normalized local date", () => {
	const selected = toggleCalendarDate(
		new Date(2026, 8, 6, 8),
		new Date(2026, 8, 7, 22),
	);

	assert.ok(selected);
	assert.equal(formatDateInput(selected), "2026-09-07");
	assert.equal(selected.getHours(), 0);
});

test("serializes submit wall clock as a timezone-free local timestamp", () => {
	const stamp = formatLocalDateTime(new Date(2026, 8, 6, 20, 15, 9, 123));

	assert.equal(stamp, "2026-09-06T20:15:09.123");
	assert.equal(stamp.includes("Z"), false);
	assert.equal(/[+-]\d{2}:?\d{2}$/.test(stamp), false);
});

test("serializes a date range as local day bounds without UTC conversion", () => {
	const range = getLocalRangeApi(new Date(2026, 8, 1, 10), new Date(2026, 8, 8, 22));

	assert.deepEqual(range, {
		startDate: "2026-09-01T00:00:00.000",
		endDate: "2026-09-08T23:59:59.999",
	});
});

test("week columns start on Monday", () => {
	// 2026-09-06 是周日 → 所在周的周一是 2026-08-31
	const monday = getWeekStart(new Date(2026, 8, 6));

	assert.equal(formatDateInput(monday), "2026-08-31");
});

test("groups consecutive days into calendar weeks aligned to Monday", () => {
	// 8/29(六) 8/30(日) 8/31(一) 9/1(二) … 9/6(日)
	const days = [
		new Date(2026, 7, 29),
		new Date(2026, 7, 30),
		new Date(2026, 7, 31),
		new Date(2026, 8, 1),
		new Date(2026, 8, 2),
		new Date(2026, 8, 6),
	];
	const weeks = groupDatesByWeek(days);

	assert.equal(weeks.length, 2);
	assert.equal(formatDateInput(weeks[0].weekStart), "2026-08-24");
	assert.equal(formatDateInput(weeks[1].weekStart), "2026-08-31");
	// 8/29 是周六 → 第一列 index 5；8/30 是周日 → index 6
	assert.equal(weeks[0].days[5] && formatDateInput(weeks[0].days[5]), "2026-08-29");
	assert.equal(weeks[0].days[6] && formatDateInput(weeks[0].days[6]), "2026-08-30");
	// 9/6 周日 → 最后一列 index 6
	assert.equal(weeks[1].days[6] && formatDateInput(weeks[1].days[6]), "2026-09-06");
});

test("places month labels on the column containing the 1st of the month", () => {
	const weeks = groupDatesByWeek([
		new Date(2026, 6, 27),
		new Date(2026, 6, 28),
		new Date(2026, 6, 29),
		new Date(2026, 6, 30),
		new Date(2026, 6, 31),
		new Date(2026, 7, 1),
		new Date(2026, 7, 2),
		new Date(2026, 7, 3),
	]);
	const labels = getMonthLabelColumns(weeks);

	assert.deepEqual(labels, [{ label: "8月", index: 0 }]);
});
