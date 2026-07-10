"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface SettingsSearchActionProps {
	value: string;
	onChange: (value: string) => void;
}

export function SettingsSearchAction({
	value,
	onChange,
}: SettingsSearchActionProps) {
	const tSettings = useTranslations("page.settings");
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const searchContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isSearchOpen && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [isSearchOpen]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				searchContainerRef.current &&
				!searchContainerRef.current.contains(event.target as Node) &&
				!value
			) {
				setIsSearchOpen(false);
			}
		};

		if (isSearchOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
	}, [isSearchOpen, value]);

	return (
		<div ref={searchContainerRef} className="relative">
			{isSearchOpen ? (
				<div className="relative">
					<Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						ref={searchInputRef}
						type="text"
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder={tSettings("searchPlaceholder")}
						className="h-7 w-48 rounded-md border border-primary/20 px-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setIsSearchOpen(true)}
					className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
					aria-label={tSettings("searchPlaceholder")}
				>
					<Search className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}
