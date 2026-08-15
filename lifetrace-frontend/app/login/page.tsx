"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/fetcher";
import { login, register } from "@/lib/auth/api";
import { useAuthStore } from "@/lib/auth/session";

type AuthMode = "login" | "register";

function safeNext(value: string | null): string {
	if (!value || !value.startsWith("/") || value.startsWith("/login")) return "/";
	return value;
}

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const setSession = useAuthStore((state) => state.setSession);
	const [mode, setMode] = useState<AuthMode>("login");
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const next = useMemo(() => safeNext(searchParams.get("next")), [searchParams]);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const response = mode === "login"
				? await login({ email, password })
				: await register({ email, password, displayName: displayName || undefined });
			setSession(response.accessToken, response.user);
			router.replace(next as Route);
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				setError("邮箱或密码不正确。");
			} else if (err instanceof ApiError && err.status === 409) {
				setError("这个邮箱已经注册过了，请直接登录。");
			} else {
				setError("登录服务暂时不可用，请稍后再试。");
			}
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f1ff,transparent_34%),linear-gradient(135deg,#f8fafc,#eef2ff)] px-4 py-10 text-slate-950">
			<div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
				<section className="grid w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-2xl shadow-slate-200/80 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
					<div className="hidden flex-col justify-between bg-slate-950 p-10 text-white lg:flex">
						<div>
							<p className="text-sm uppercase tracking-[0.35em] text-sky-300">LifeTrace</p>
							<h1 className="mt-8 text-4xl font-semibold leading-tight">
								把你的离线记录，安全同步到自己的账户里。
							</h1>
							<p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
								PWA 可以继续离线记录；联网后，同步会按账号隔离，不会再混到默认单人数据里。
							</p>
						</div>
						<div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm text-slate-200">
							<span className="text-sky-300">✓</span> 注册后会自动登录；同一邮箱下次直接登录即可。
						</div>
					</div>

					<form onSubmit={onSubmit} className="p-8 sm:p-10">
						<p className="text-sm font-medium text-sky-700">欢迎回来</p>
						<h2 className="mt-2 text-3xl font-semibold">
							{mode === "login" ? "登录 LifeTrace" : "创建 LifeTrace 账户"}
						</h2>
						<p className="mt-3 text-sm text-slate-600">
							{mode === "login"
								? "输入邮箱和密码，继续使用你的待办、笔记和习惯。"
								: "先创建一个账户，之后 Render/Neon 后端就能按用户存储数据。"}
						</p>

						<div className="mt-8 space-y-4">
							<label className="block text-sm font-medium">
								邮箱
								<input
									type="email"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									required
									autoComplete="email"
									className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4"
									placeholder="you@example.com"
								/>
							</label>

							{mode === "register" && (
								<label className="block text-sm font-medium">
									昵称（可选）
									<input
										type="text"
										value={displayName}
										onChange={(event) => setDisplayName(event.target.value)}
										autoComplete="name"
										className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4"
										placeholder="怎么称呼你？"
									/>
								</label>
							)}

							<label className="block text-sm font-medium">
								密码
								<input
									type="password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
									minLength={8}
									autoComplete={mode === "login" ? "current-password" : "new-password"}
									className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4"
									placeholder="至少 8 位"
								/>
							</label>
						</div>

						{error && (
							<p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								{error}
							</p>
						)}

						<Button
							type="submit"
							disabled={submitting}
							className="mt-7 h-11 w-full rounded-xl"
						>
							{submitting ? "处理中..." : mode === "login" ? "登录" : "注册并登录"}
						</Button>

						<button
							type="button"
							onClick={() => {
								setError(null);
								setMode(mode === "login" ? "register" : "login");
							}}
							className="mt-5 w-full text-center text-sm text-sky-700 hover:text-sky-900"
						>
							{mode === "login" ? "还没有账户？去注册" : "已经有账户？去登录"}
						</button>
					</form>
				</section>
			</div>
		</main>
	);
}
