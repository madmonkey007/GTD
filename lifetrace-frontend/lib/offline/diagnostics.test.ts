import assert from "node:assert/strict";
import test from "node:test";
import { summarizeSyncErrors } from "./diagnostics.ts";

test("reports persisted failures without exposing note payloads", () => {
	assert.deepEqual(summarizeSyncErrors([
		{ opId: "one", kind: "journal.update", uid: "note", attempts: 3, lastError: "uid not found", payload: { user_notes: "private" } },
		{ opId: "two", kind: "journal.create", uid: "new", attempts: 0 },
	]), [{ opId: "one", label: "笔记 · 修改", attempts: 3, message: "uid not found" }]);
});

test("clears diagnostics when the queue is empty", () => {
	assert.deepEqual(summarizeSyncErrors([]), []);
});
