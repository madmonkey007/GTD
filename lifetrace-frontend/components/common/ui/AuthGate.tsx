"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { fetchCurrentUser } from "@/lib/auth/api";
import { getAuthToken, getStoredAuthUser, useAuthStore } from "@/lib/auth/session";
import { CapabilitiesSync } from "./CapabilitiesSync";
import { DockTriggerZone } from "./DockTriggerZone";
import { FrontendBoot } from "./FrontendBoot";
import { SyncController } from "./SyncController";

interface AuthGateProps {
	children: ReactNode;
}

const PUBLIC_PATHS = new Set(["/login"]);

export function AuthGate({ children }: AuthGateProps) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const setSession = useAuthStore((state) => state.setSession);
	const clearSession = useAuthStore((state) => state.clearSession);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const token = getAuthToken();
		const isPublic = PUBLIC_PATHS.has(pathname);

		if (!token) {
			if (!isPublic) {
				const next = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;
				router.replace(`/login?next=${encodeURIComponent(next)}` as Route);
			}
			setChecked(true);
			return;
		}

		const storedUser = getStoredAuthUser();
		if (storedUser) setSession(token, storedUser);

		fetchCurrentUser()
			.then((user) => {
				if (cancelled) return;
				setSession(token, user);
				setChecked(true);
			})
			.catch(() => {
				if (cancelled) return;
				clearSession();
				if (!isPublic) {
					router.replace(`/login?next=${encodeURIComponent(pathname)}` as Route);
				}
				setChecked(true);
			});

		return () => {
			cancelled = true;
		};
	}, [pathname, router, searchParams, setSession, clearSession]);

	if (PUBLIC_PATHS.has(pathname)) return <>{children}</>;
	if (!checked) return <FrontendBoot />;
	if (!getAuthToken()) return <FrontendBoot />;
	return (
		<>
			<SyncController />
			<CapabilitiesSync />
			<DockTriggerZone />
			{children}
		</>
	);
}
