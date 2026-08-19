"use client";

import type { Route } from "next";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/common/ui/PasswordInput";
import { ApiError } from "@/lib/api/fetcher";
import { login, register } from "@/lib/auth/api";
import { useAuthStore } from "@/lib/auth/session";

type AuthMode = "login" | "register";

function safeNext(value: string | null): string {
	if (!value || !value.startsWith("/") || value.startsWith("/login")) return "/";
	return value;
}

const PANEL_POINTS = [
	"待办、笔记、习惯，收进同一个账户",
	"离线继续记录，联网自动同步",
	"按账户隔离，数据不混用",
];

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

	const inputClass =
		"mt-2 h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/15";

	return (
		<main className="flex min-h-[100dvh] items-center justify-center bg-muted/40 px-4 py-10">
			<section className="grid w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-border bg-background shadow-xl shadow-black/[0.06] lg:grid-cols-[1fr_1.1fr]">
				{/* 品牌面：固定深色（两种主题下一致），与应用主题色同源 */}
				<div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_55%)]"
					/>
					<div className="relative">
						<div className="flex items-center gap-2.5">
							<Image
								src="/free-todo-logos/free_todo_icon_4_with_grid.png"
								alt="LifeTrace"
								width={28}
								height={28}
								className="rounded-md"
							/>
							<span className="text-sm font-semibold tracking-wide">LifeTrace</span>
						</div>
						<h1 className="mt-10 text-[2rem] font-semibold leading-snug tracking-tight">
							记录生活，
							<br />
							不止待办。
						</h1>
						<p className="mt-4 max-w-[36ch] text-sm leading-6 text-zinc-400">
							你的每一天、每一笔思考，都值得被好好安放。
						</p>
					</div>
					<ul className="relative space-y-3 text-sm text-zinc-300">
						{PANEL_POINTS.map((point) => (
							<li key={point} className="flex items-center gap-2.5">
								<CheckCircle2 className="h-4 w-4 shrink-0 text-primary/80" strokeWidth={1.5} />
								{point}
							</li>
						))}
					</ul>
				</div>

				{/* 表单面：跟随应用主题 */}
				<form onSubmit={onSubmit} className="flex flex-col justify-center p-8 sm:p-12">
					<div className="flex items-center gap-2.5 lg:hidden">
						<Image
							src="/free-todo-logos/free_todo_icon_4_dark_with_grid.png"
							alt="LifeTrace"
							width={24}
							height={24}
							className="rounded-md dark:hidden"
						/>
						<Image
							src="/free-todo-logos/free_todo_icon_4_with_grid.png"
							alt="LifeTrace"
							width={24}
							height={24}
							className="hidden rounded-md dark:block"
						/>
						<span className="text-sm font-semibold">LifeTrace</span>
					</div>

					<h2 className="mt-6 text-2xl font-semibold tracking-tight lg:mt-0">
						{mode === "login" ? "欢迎回来" : "创建账户"}
					</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{mode === "login"
							? "登录后继续使用你的待办、笔记和习惯。"
							: "注册即可登录，离线记录的数据会同步到你的账户。"}
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
								className={inputClass}
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
									className={inputClass}
									placeholder="怎么称呼你？"
								/>
							</label>
						)}

						<label className="block text-sm font-medium">
							密码
							<PasswordInput
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
								minLength={8}
								autoComplete={mode === "login" ? "current-password" : "new-password"}
								className={inputClass}
								placeholder="至少 8 位"
							/>
						</label>
					</div>

					{error && (
						<p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{error}
						</p>
					)}

					<Button
						type="submit"
						disabled={submitting}
						className="mt-7 h-11 w-full rounded-xl text-sm active:translate-y-[1px]"
					>
						{submitting ? "处理中..." : mode === "login" ? "登录" : "注册并登录"}
					</Button>

					<button
						type="button"
						onClick={() => {
							setError(null);
							setMode(mode === "login" ? "register" : "login");
						}}
						className="mt-5 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						{mode === "login" ? "还没有账户？去注册" : "已经有账户？去登录"}
					</button>
				</form>
			</section>
		</main>
	);
}
