"use client";

import { customFetcher } from "@/lib/api/fetcher";
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

export function fetchCurrentUser(): Promise<AuthUser> {
	return customFetcher<AuthUser>("/api/auth/me");
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

