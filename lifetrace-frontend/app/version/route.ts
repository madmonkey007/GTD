import { execSync } from "node:child_process";
import { NextResponse } from "next/server";

// 明确使用 Node.js 运行时（需要 child_process 执行 git）
export const runtime = "nodejs";
// 每次请求都实时求值，禁止 Next.js 在构建时把本路由静态化缓存
export const dynamic = "force-dynamic";

/**
 * 解析当前 git commit：
 * - dev（NODE_ENV !== "production"）：实时执行 `git rev-parse HEAD`，让版本戳跟随最新提交，
 *   无需重启 dev server（next.config.ts 注入的 NEXT_PUBLIC_GIT_COMMIT 是启动那一刻 baked 的旧值）。
 * - 生产/打包：git 通常不可用，回退到构建时注入的 NEXT_PUBLIC_GIT_COMMIT（对打包产物而言该值本就正确）。
 */
function resolveCommit(): string {
	if (process.env.NODE_ENV !== "production") {
		try {
			const head = execSync("git rev-parse HEAD", {
				stdio: ["ignore", "pipe", "ignore"],
				timeout: 2000,
			})
				.toString()
				.trim();
			if (head) return head;
		} catch {
			// git 不可用或当前目录非仓库，落到构建时回退值
		}
	}
	return process.env.NEXT_PUBLIC_GIT_COMMIT || "unknown";
}

export async function GET() {
	return NextResponse.json(
		{
			version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
			buildType: process.env.NEXT_PUBLIC_BUILD_TYPE || "unknown",
			commit: resolveCommit(),
		},
		{ headers: { "Cache-Control": "no-store" } },
	);
}
