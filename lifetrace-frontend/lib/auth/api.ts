"use client";

import { customFetcher } from "@/lib/api/fetcher";
import { authHeaders } from "./session";
import type { AuthUser } from "./session";

interface AuthResponse {
	accessToken: string;
	tokenType: "bearer";
	user: AuthUser;
}

interface Credentials {
	email: string;
	password: string;
	displayName?: string;
}

export function login(credentials: Credentials): Promise<AuthResponse> {
	return customFetcher<AuthResponse>("/api/auth/login", {
		method: "POST",
		data: {
			email: credentials.email,
			password: credentials.password,
		},
	});
}

export function register(credentials: Credentials): Promise<AuthResponse> {
	return customFetcher<AuthResponse>("/api/auth/register", {
		method: "POST",
		data: {
			email: credentials.email,
			password: credentials.password,
			displayName: credentials.displayName,
		},
	});
}

export function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
	return customFetcher<AuthUser>("/api/auth/me", { signal });
}

export function updateDisplayName(displayName: string): Promise<AuthUser> {
	return customFetcher<AuthUser>("/api/auth/me", {
		method: "PATCH",
		data: { displayName },
	});
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
	return customFetcher<void>("/api/auth/password", {
		method: "PUT",
		data: { oldPassword, newPassword },
	});
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function uploadAvatar(file: File): Promise<AuthUser> {
	const formData = new FormData();
	formData.append("file", file);
	return customFetcher<AuthUser>("/api/auth/avatar", {
		method: "PUT",
		body: formData,
	});
}

export function deleteAvatar(): Promise<void> {
	return customFetcher<void>("/api/auth/avatar", { method: "DELETE" });
}

/** 拉取头像并转成本地 blob URL；无头像或失败返回 null */
export async function fetchAvatarUrl(userId: number): Promise<string | null> {
	const response = await fetch(`/api/auth/avatar/${userId}`, {
		headers: authHeaders(),
	});
	if (!response.ok) return null;
	const blob = await response.blob();
	return URL.createObjectURL(blob);
}

