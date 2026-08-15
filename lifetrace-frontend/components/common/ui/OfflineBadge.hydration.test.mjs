import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OfflineBadge keeps the server and initial client tree empty", async () => {
	const source = await readFile(new URL("./OfflineBadge.tsx", import.meta.url), "utf8");
	assert.match(source, /useSyncExternalStore/);
	assert.match(source, /if \(!mounted\)\s*\{?\s*return null/);
});
