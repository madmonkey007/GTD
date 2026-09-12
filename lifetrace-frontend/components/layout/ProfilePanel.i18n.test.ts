import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "ProfilePanel.tsx"), "utf8");
const locales = ["zh", "en"] as const;

function readMessages(locale: (typeof locales)[number]): Record<string, unknown> {
	return JSON.parse(
		readFileSync(resolve(here, `../../lib/i18n/messages/${locale}.json`), "utf8"),
	) as Record<string, unknown>;
}

function resolveMessage(messages: Record<string, unknown>, key: string): unknown {
	let value: unknown = messages;
	for (const segment of key.split(".")) {
		value =
			value && typeof value === "object"
				? (value as Record<string, unknown>)[segment]
				: undefined;
	}
	return value;
}

test("ProfilePanel root translator only references root-level messages", () => {
	const rootKeys = [...source.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]);
	for (const locale of locales) {
		const messages = readMessages(locale);
		assert.deepEqual(
			rootKeys.filter((key) => typeof resolveMessage(messages, key) !== "string"),
			[],
			`${locale} has missing root-level messages`,
		);
	}
});

test("ProfilePanel profile translator references profile messages", () => {
	const profileKeys = [...source.matchAll(/\btProfile\("([^"]+)"/g)].map(
		(match) => match[1],
	);

	for (const locale of locales) {
		const messages = readMessages(locale);
		assert.deepEqual(
			profileKeys.filter(
				(key) => typeof resolveMessage(messages, `profile.${key}`) !== "string",
			),
			[],
			`${locale} has missing profile messages`,
		);
	}
});
