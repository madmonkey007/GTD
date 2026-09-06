import assert from "node:assert/strict";
import test from "node:test";

import {
	formatDateInput,
	getLocalDayApiRange,
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
