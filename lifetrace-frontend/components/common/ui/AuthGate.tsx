"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { fetchCurrentUser } from "@/lib/auth/api";
import { ApiError } from "@/lib/api/fetcher";
import { getAuthToken, getStoredAuthUser, useAuthStore } from "@/lib/auth/session";
import { CapabilitiesSync } from "./CapabilitiesSync";
import { DockTriggerZone } from "./DockTriggerZone";
import { FrontendBoot } from "./FrontendBoot";
import { SyncController } from "./SyncController";

const PUBLIC_PATHS = new Set(["/login"]);

// 后台校验 token 的超时：隧道冷启动时首个请求可能挂很久，
// 超时不清 session（视为"暂无法确认"，沿用本地会话），避免启动被拖死
const AUTH_CHECK_TIMEOUT_MS = 3000;

export function AuthGate({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const setSession = useAuthStore((state) => state.setSession);
	const clearSession = useAuthStore((state) => state.clearSession);
	const [checked, setChecked] = useState(false);

	useEffect(() => {
		// 首页巨型 chunk 与鉴权并行预加载：否则要等鉴权通过才开始下载动态 chunk
		void import("@/app/home/HomePageClient").catch(() => {});
	}, []);

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
		// 有本地缓存的用户：先放行渲染（setChecked），后台校验 token；
		// 只有明确 401/网络失败且无缓存用户时才回登录页，不再阻塞启动
		if (storedUser) setChecked(true);

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS);
		fetchCurrentUser(controller.signal)
			.then((user) => {
				if (cancelled) return;
				setSession(token, user);
				setChecked(true);
			})
			.catch((err) => {
				if (cancelled) return;
				// 超时/网络错误：保留本地会话继续用；仅明确的 401/403（token 失效）才登出
				if (
					controller.signal.aborted ||
					!(err instanceof ApiError) ||
					(err.status !== 401 && err.status !== 403)
				) {
					setChecked(true);
					return;
				}
				clearSession();
				if (!isPublic) {
					router.replace(`/login?next=${encodeURIComponent(pathname)}` as Route);
				}
				setChecked(true);
			})
			.finally(() => clearTimeout(timer));

		return () => {
			cancelled = true;
			controller.abort();
			clearTimeout(timer);
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
