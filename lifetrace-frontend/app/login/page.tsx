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

/** 手绘风格 SVG 装饰：涂鸦线条、圆圈、星星、箭头等 */
function HandDrawnDecorations() {
	return (
		<svg
			aria-hidden
			className="pointer-events-none absolute inset-0 h-full w-full"
			viewBox="0 0 420 660"
			preserveAspectRatio="xMidYMid slice"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<style>{`
					.hd-stroke {
						fill: none;
						stroke: rgb(255 255 255);
						stroke-linecap: round;
						stroke-linejoin: round;
					}
					.hd-accent {
						fill: none;
						stroke: color-mix(in oklab, var(--primary) 82%, white);
						stroke-linecap: round;
						stroke-linejoin: round;
					}
				`}</style>
			</defs>

			{/* 顶部：手绘波浪线 */}
			<path
				d="M 16 44 Q 34 28, 52 42 Q 70 56, 88 40 Q 104 26, 124 38"
				className="hd-stroke"
				strokeOpacity="0.4"
				strokeWidth="2"
			/>
			<path
				d="M 22 62 Q 40 50, 56 60 Q 72 70, 90 58"
				className="hd-stroke"
				strokeOpacity="0.25"
				strokeWidth="1.6"
			/>

			{/* 右上：手绘闪光 + 星点 */}
			<g transform="translate(330, 52)">
				<path
					d="M 0 -16 L 3 -4 L 14 -8 L 5 0 L 14 8 L 3 4 L 0 16 L -3 4 L -14 8 L -5 0 L -14 -8 L -3 -4 Z"
					className="hd-stroke"
					strokeOpacity="0.55"
					strokeWidth="1.4"
				/>
			</g>
			<g transform="translate(368, 102)">
				<path
					d="M 0 -8 L 1.8 -2.2 L 7 -4 L 2.6 0 L 7 4 L 1.8 2.2 L 0 8 L -1.8 2.2 L -7 4 L -2.6 0 L -7 -4 L -1.8 -2.2 Z"
					className="hd-stroke"
					strokeOpacity="0.35"
					strokeWidth="1.1"
				/>
			</g>
			<path d="M 306 104 L 299 111 M 318 114 L 313 119" className="hd-stroke" strokeOpacity="0.35" strokeWidth="1.3" />

			{/* 左侧中部：手绘双圆圈 */}
			<circle cx="46" cy="222" r="24" className="hd-stroke" strokeOpacity="0.38" strokeWidth="1.8" strokeDasharray="5 7" />
			<circle cx="53" cy="215" r="15" className="hd-stroke" strokeOpacity="0.26" strokeWidth="1.3" />

			{/* 中部：手绘箭头 */}
			<g transform="translate(180, 322)">
				<path d="M 0 0 Q 24 -10, 48 -2 Q 72 6, 96 -8" className="hd-stroke" strokeOpacity="0.45" strokeWidth="1.8" />
				<path d="M 87 -17 L 98 -9 L 85 -1" className="hd-stroke" strokeOpacity="0.45" strokeWidth="1.8" />
			</g>

			{/* 右上侧：螺旋 */}
			<path
				d="M 338 212 Q 352 200, 360 214 Q 368 230, 350 236 Q 330 242, 326 222 Q 322 200, 344 192 Q 368 184, 378 208"
				className="hd-stroke"
				strokeOpacity="0.3"
				strokeWidth="1.4"
			/>

			{/* 标题旁的主题色手绘圈注 */}
			<ellipse
				cx="130"
				cy="148"
				rx="120"
				ry="64"
				transform="rotate(-4 130 148)"
				className="hd-accent"
				strokeOpacity="0.38"
				strokeWidth="1.6"
				strokeDasharray="7 9"
			/>
			{/* 标题下的主题色手绘下划线 */}
			<path d="M 24 214 Q 70 208, 116 214 Q 160 220, 204 212" className="hd-accent" strokeOpacity="0.7" strokeWidth="2.4" />

			{/* 下部：手绘待办清单涂鸦 */}
			<g transform="translate(300, 434)">
				<rect x="0" y="0" width="18" height="18" rx="3" transform="rotate(-4 9 9)" className="hd-stroke" strokeOpacity="0.5" strokeWidth="1.6" />
				<path d="M 4 9 L 8 13 L 15 4" className="hd-stroke" strokeOpacity="0.6" strokeWidth="1.8" />
				<path d="M 28 6 Q 46 3, 62 7" className="hd-stroke" strokeOpacity="0.3" strokeWidth="1.4" />
				<path d="M 28 14 Q 40 12, 52 15" className="hd-stroke" strokeOpacity="0.2" strokeWidth="1.4" />
			</g>
			<g transform="translate(302, 472)">
				<rect x="0" y="0" width="16" height="16" rx="3" transform="rotate(3 8 8)" className="hd-stroke" strokeOpacity="0.3" strokeWidth="1.3" />
				<path d="M 26 5 Q 44 2, 60 6" className="hd-stroke" strokeOpacity="0.22" strokeWidth="1.3" />
			</g>

			{/* 左下：纸飞机与虚线尾迹 */}
			<g transform="translate(56, 452) rotate(-10)">
				<path d="M 0 0 L 28 10 L 0 20 L 6 10 Z" className="hd-stroke" strokeOpacity="0.5" strokeWidth="1.4" />
			</g>
			<path d="M 16 486 Q 32 476, 46 470" className="hd-stroke" strokeOpacity="0.35" strokeWidth="1.3" strokeDasharray="3 5" />

			{/* 底部：波浪线 */}
			<path
				d="M 90 606 Q 116 592, 142 602 Q 168 612, 194 598 Q 220 586, 246 596 Q 268 604, 290 594"
				className="hd-stroke"
				strokeOpacity="0.3"
				strokeWidth="1.6"
			/>

			{/* 散落的手绘小十字与点 */}
			<path d="M 190 120 L 198 128 M 198 120 L 190 128" className="hd-stroke" strokeOpacity="0.35" strokeWidth="1.2" />
			<path d="M 250 262 L 256 268 M 256 262 L 250 268" className="hd-stroke" strokeOpacity="0.25" strokeWidth="1.1" />
			<circle cx="150" cy="90" r="2.5" fill="rgb(255 255 255)" fillOpacity="0.3" />
			<circle cx="290" cy="180" r="2" fill="rgb(255 255 255)" fillOpacity="0.25" />
			<circle cx="90" cy="330" r="2.2" fill="rgb(255 255 255)" fillOpacity="0.25" />
			<circle cx="220" cy="420" r="2" fill="rgb(255 255 255)" fillOpacity="0.2" />
			<path d="M 150 90 L 290 180" className="hd-stroke" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="3 6" />
		</svg>
	);
}

/** 表单区域不再叠加装饰（卡片后的页面背景已有手绘元素） */
function FormBackgroundDoodles() {
	return null;
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

	const inputClass =
		"mt-2 h-11 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/15";

	return (
		<main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-muted/40 via-background to-muted/60 px-4 py-10">
			{/* 卡片背后的页面背景手绘涂鸦 */}
			<div className="pointer-events-none absolute inset-0">
				<svg
					aria-hidden
					className="h-full w-full text-foreground opacity-[0.16] dark:opacity-[0.22]"
					viewBox="0 0 1440 900"
					preserveAspectRatio="xMidYMid slice"
					xmlns="http://www.w3.org/2000/svg"
				>
					<defs>
						<style>{`
							.bg-stroke {
								fill: none;
								stroke: currentColor;
								stroke-linecap: round;
								stroke-linejoin: round;
							}
							.bg-accent {
								fill: none;
								stroke: var(--primary);
								stroke-linecap: round;
								stroke-linejoin: round;
							}
						`}</style>
					</defs>

					{/* 左上：手绘太阳 */}
					<g transform="translate(150, 150)">
						<circle r="38" className="bg-stroke" strokeWidth="2.4" strokeDasharray="8 6" />
						<path
							d="M 0 -60 L 0 -80 M 42 -42 L 56 -56 M 60 0 L 80 0 M 42 42 L 56 56 M 0 60 L 0 80 M -42 42 L -56 56 M -60 0 L -80 0 M -42 -42 L -56 -56"
							className="bg-stroke"
							strokeWidth="2"
						/>
					</g>

					{/* 顶部中间：云朵 */}
					<path
						d="M 600 96 Q 602 70, 630 68 Q 644 46, 674 56 Q 700 44, 714 68 Q 742 70, 738 96"
						className="bg-stroke"
						strokeWidth="2.2"
					/>
					<path d="M 618 118 L 608 136 M 662 120 L 652 138 M 706 118 L 696 136" className="bg-stroke" strokeWidth="1.6" />

					{/* 右上：闪光与手绘圆 */}
					<g transform="translate(1300, 130)">
						<path
							d="M 0 -26 L 5 -6 L 24 -12 L 8 0 L 24 12 L 5 6 L 0 26 L -5 6 L -24 12 L -8 0 L -24 -12 L -5 -6 Z"
							className="bg-stroke"
							strokeWidth="2"
						/>
					</g>
					<circle cx="1372" cy="222" r="28" className="bg-stroke" strokeWidth="1.8" strokeDasharray="6 7" />
					<path d="M 1332 258 L 1348 244 M 1358 266 L 1370 254" className="bg-stroke" strokeWidth="1.6" />

					{/* 左侧边缘：虚线圈 + 主题色小星 */}
					<circle cx="70" cy="520" r="34" className="bg-stroke" strokeWidth="2" strokeDasharray="7 8" />
					<g transform="translate(180, 640) rotate(-12)">
						<path
							d="M 0 -18 L 3.4 -4.4 L 16 -8.4 L 5.6 0 L 16 8.4 L 3.4 4.4 L 0 18 L -3.4 4.4 L -16 8.4 L -5.6 0 L -16 -8.4 L -3.4 -4.4 Z"
							className="bg-accent"
							strokeOpacity="0.8"
							strokeWidth="1.8"
						/>
					</g>

					{/* 左下：螺旋 */}
					<path
						d="M 176 772 Q 198 752, 212 774 Q 226 798, 198 808 Q 166 818, 160 786 Q 154 750, 192 738 Q 234 726, 250 766"
						className="bg-stroke"
						strokeWidth="2.2"
					/>

					{/* 底部：长波浪 */}
					<path
						d="M 60 852 Q 130 836, 200 848 Q 270 860, 340 844 Q 410 830, 480 842 Q 550 854, 620 840 Q 690 828, 760 840 Q 830 852, 900 838 Q 970 826, 1040 838 Q 1110 850, 1180 836 Q 1250 824, 1320 836 Q 1370 844, 1400 838"
						className="bg-stroke"
						strokeWidth="2"
					/>

					{/* 右下：指向卡片的手绘箭头 */}
					<g transform="translate(1080, 690)">
						<path d="M 130 66 Q 84 60, 48 34 Q 22 16, 8 -12" className="bg-stroke" strokeWidth="2.4" />
						<path d="M 2 -2 L 9 -14 L 22 -8" className="bg-stroke" strokeWidth="2.4" />
					</g>

					{/* 右下：纸飞机与尾迹 */}
					<g transform="translate(1290, 700) rotate(14)">
						<path d="M 0 0 L 46 16 L 0 32 L 10 16 Z" className="bg-stroke" strokeWidth="2" />
					</g>
					<path d="M 1206 778 Q 1236 758, 1264 738" className="bg-stroke" strokeWidth="1.8" strokeDasharray="5 8" />

					{/* 右侧边缘：手绘对勾 */}
					<g transform="translate(1380, 470) rotate(6)">
						<rect x="0" y="0" width="30" height="30" rx="5" className="bg-stroke" strokeWidth="2" />
						<path d="M 7 15 L 13 22 L 25 7" className="bg-accent" strokeOpacity="0.9" strokeWidth="2.4" />
					</g>

					{/* 散落的小十字 */}
					<path d="M 380 300 L 392 312 M 392 300 L 380 312" className="bg-stroke" strokeWidth="1.8" />
					<path d="M 1060 240 L 1070 250 M 1070 240 L 1060 250" className="bg-stroke" strokeWidth="1.6" />
					<path d="M 250 340 L 258 348 M 258 340 L 250 348" className="bg-stroke" strokeWidth="1.4" />
					<path d="M 1210 380 L 1218 388 M 1218 380 L 1210 388" className="bg-stroke" strokeWidth="1.4" />
				</svg>
			</div>

			<section className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-border/60 bg-background/80 shadow-2xl shadow-black/[0.08] backdrop-blur-sm lg:grid-cols-[1fr_1.1fr]">
				{/* 品牌面：深色背景 + 手绘涂鸦装饰 */}
				<div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex">
					{/* 底层渐变光晕 */}
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_55%),radial-gradient(circle_at_80%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_50%)]"
					/>
					{/* 手绘涂鸦装饰层 */}
					<HandDrawnDecorations />
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
				<form onSubmit={onSubmit} className="relative flex flex-col justify-center p-8 sm:p-12">
					<FormBackgroundDoodles />
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
