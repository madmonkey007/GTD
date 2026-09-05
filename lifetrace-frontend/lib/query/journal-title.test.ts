import assert from "node:assert/strict";
import test from "node:test";

import {
	applyGeneratedTitleToDraft,
	createJournalTitleRequestGate,
	isPseudoJournalTitle,
	shouldGenerateJournalTitle,
} from "./journal-title.ts";

test("recognizes only empty, Untitled, and minute timestamp pseudo titles", () => {
	assert.equal(isPseudoJournalTitle(""), true);
	assert.equal(isPseudoJournalTitle(" Untitled "), true);
	assert.equal(isPseudoJournalTitle("2026-09-05 10:30"), true);
	assert.equal(isPseudoJournalTitle("用户标题"), false);
	assert.equal(isPseudoJournalTitle("2026-9-5 10:30"), false);
	assert.equal(isPseudoJournalTitle("2026-09-05 10:30:00"), false);
});

test("starts generation only for a persisted pseudo-title note with content", () => {
	assert.equal(
		shouldGenerateJournalTitle({ id: 1, name: "Untitled", userNotes: "正文" }),
		true,
	);
	assert.equal(
		shouldGenerateJournalTitle({ id: 0, name: "Untitled", userNotes: "正文" }),
		false,
	);
	assert.equal(
		shouldGenerateJournalTitle({ id: 1, name: "真实标题", userNotes: "正文" }),
		false,
	);
	assert.equal(
		shouldGenerateJournalTitle({ id: 1, name: "Untitled", userNotes: "  " }),
		false,
	);
});

test("applies a completed title only to the matching still-pseudo draft", () => {
	const draft = { id: 1, name: "2026-09-05 10:30", userNotes: "正文" };
	assert.deepEqual(applyGeneratedTitleToDraft(draft, { id: 1, name: "完整标题" }), {
		...draft,
		name: "完整标题",
	});
	assert.equal(
		applyGeneratedTitleToDraft(
			{ ...draft, name: "用户刚写的标题" },
			{ id: 1, name: "AI 标题" },
		).name,
		"用户刚写的标题",
	);
	assert.equal(
		applyGeneratedTitleToDraft(draft, { id: 2, name: "其他标题" }).name,
		"2026-09-05 10:30",
	);
});

test("allows only one title request per note and releases the note after completion", async () => {
	const gate = createJournalTitleRequestGate();
	let calls = 0;
	let release: (() => void) | undefined;
	const pending = gate.run(7, async () => {
		calls += 1;
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		return "done";
	});
	const duplicate = gate.run(7, async () => {
		calls += 1;
		return "duplicate";
	});

	assert.equal(duplicate, undefined);
	assert.equal(calls, 1);
	release?.();
	assert.equal(await pending, "done");
	assert.equal(await gate.run(7, async () => "retry"), "retry");
});
