"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useId,
} from "react";

const SettingsSearchContext = createContext<string>("");
const SettingsSearchMatchContext = createContext<
	((id: string, isMatch: boolean) => void) | null
>(null);

export function SettingsSearchProvider({
	query = "",
	children,
}: {
	query?: string;
	children: ReactNode;
}) {
	return (
		<SettingsSearchContext.Provider value={query}>
			{children}
		</SettingsSearchContext.Provider>
	);
}

export function SettingsSearchMatchProvider({
	onMatchChange,
	children,
}: {
	onMatchChange: (id: string, isMatch: boolean) => void;
	children: ReactNode;
}) {
	return (
		<SettingsSearchMatchContext.Provider value={onMatchChange}>
			{children}
		</SettingsSearchMatchContext.Provider>
	);
}

const normalizeSearchValue = (value: string) => value.toLowerCase().trim();

const doesSearchMatch = (
	query: string,
	values: Array<string | undefined>,
) => {
	const normalizedQuery = normalizeSearchValue(query);
	if (!normalizedQuery) return true;

	const haystack = values.filter(Boolean).join(" ").toLowerCase();
	if (!haystack) return false;

	const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
	return tokens.every((token) => haystack.includes(token));
};

interface SettingsSectionProps {
	title: string;
	description?: string;
	children: ReactNode;
	searchKeywords?: Array<string | undefined>;
}

/**
 * 设置区块容器组件
 */
export function SettingsSection({
	title,
	description,
	children,
	searchKeywords,
}: SettingsSectionProps) {
	const searchQuery = useContext(SettingsSearchContext);
	const isSearchActive = normalizeSearchValue(searchQuery).length > 0;
	const reportMatch = useContext(SettingsSearchMatchContext);
	const sectionId = useId();

	const isMatch = doesSearchMatch(searchQuery, [
		title,
		description,
		...(searchKeywords ?? []),
	]);

	useEffect(() => {
		if (!reportMatch) return;
		reportMatch(sectionId, isMatch);
		return () => {
			reportMatch(sectionId, false);
		};
	}, [reportMatch, sectionId, isMatch]);

	if (!isMatch) {
		return null;
	}

	return (
		<div
			className={
				isSearchActive
					? "rounded-xl border border-primary/30 bg-primary/[0.03] p-5 ring-1 ring-primary/15 transition-colors duration-200"
					: "rounded-xl border border-border/50 bg-card/30 p-5"
			}
		>
			<div className="mb-4">
				<h3 className="text-[13px] font-medium tracking-wide text-foreground/90">
					{title}
				</h3>
				{description && (
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">
						{description}
					</p>
				)}
			</div>
			{children}
		</div>
	);
}
