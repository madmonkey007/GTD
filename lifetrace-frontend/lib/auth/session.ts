"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface AuthUser {
	id: number;
	email: string;
	displayName?: string | null;
}

interface AuthState {
	token: string | null;
	user: AuthUser | null;
	setSession: (token: string, user: AuthUser) => void;
	updateUser: (user: Partial<AuthUser>) => void;
	clearSession: () => void;
}

export const AUTH_TOKEN_KEY = "lifetrace.auth.token";
export const AUTH_USER_KEY = "lifetrace.auth.user";

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			token: null,
			user: null,
			setSession: (token, user) => {
				if (typeof window !== "undefined") {
					window.localStorage.setItem(AUTH_TOKEN_KEY, token);
					window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
				}
				set({ token, user });
			},
			updateUser: (partial) => {
				set((state) => {
					if (!state.user) return state;
					const user = { ...state.user, ...partial };
					if (typeof window !== "undefined") {
						window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
					}
					return { user };
				});
			},
			clearSession: () => {
				if (typeof window !== "undefined") {
					window.localStorage.removeItem(AUTH_TOKEN_KEY);
					window.localStorage.removeItem(AUTH_USER_KEY);
				}
				set({ token: null, user: null });
			},
		}),
		{
			name: "lifetrace-auth",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({ token: state.token, user: state.user }),
		},
	),
);

export function getAuthToken(): string | null {
	if (typeof window === "undefined") return null;
	return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? useAuthStore.getState().token;
}

export function getStoredAuthUser(): AuthUser | null {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(AUTH_USER_KEY);
	if (!raw) return useAuthStore.getState().user;
	try {
		return JSON.parse(raw) as AuthUser;
	} catch {
		return null;
	}
}

export function authHeaders(headers?: HeadersInit): Record<string, string> {
	const normalized: Record<string, string> = {};
	if (headers instanceof Headers) {
		headers.forEach((value, key) => {
			normalized[key] = value;
		});
	} else if (Array.isArray(headers)) {
		for (const [key, value] of headers) {
			normalized[key] = value;
		}
	} else if (headers) {
		Object.assign(normalized, headers);
	}

	const token = getAuthToken();
	if (token && !Object.keys(normalized).some((key) => key.toLowerCase() === "authorization")) {
		normalized.Authorization = `Bearer ${token}`;
	}
	return normalized;
}

