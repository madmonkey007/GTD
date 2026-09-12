import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

// 获取版本信息
const packageJson = require("./package.json");
const APP_VERSION = packageJson.version;

// 获取 Git Commit Hash（取前 8 位）
let GIT_COMMIT = "unknown";
try {
	GIT_COMMIT = execSync("git rev-parse HEAD").toString().trim().slice(0, 8);
} catch {
	console.warn("无法获取 Git commit hash");
}

// 判断是 build 版还是 dev 版
const BUILD_TYPE = process.env.NODE_ENV === "production" ? "build" : "dev";

// 从环境变量读取 API 地址，如果读不到就使用 localhost:8100（Build 模式默认后端代理端口）。
// 注意：8100 对应 src-tauri/src/config.rs 的 BUILD_BACKEND_PORT，build 模式下 axum 代理监听于此。
// 开发模式请通过 NEXT_PUBLIC_API_URL 显式覆盖（例如 8001），不要依赖 fallback。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";
const apiUrl = new URL(API_BASE_URL);

const nextConfig: NextConfig = {
	output: "standalone",
	// 钉住 workspace root 为本目录。
	// 否则 Turbopack 会向上扫描 lockfile，命中 D:\pnpm-lock.yaml（仓库外的游离文件）
	// 并把 D:\ 当成根；standalone 产物随之按「根→项目」的相对路径嵌套成
	// .next/standalone/manus/GTD/lifetrace-frontend/server.js，而 Tauri 侧
	// (nextjs.rs get_server_path / tauri-prebuild.js / tauri-copy-resources.js /
	// resolve-symlinks.js / copy-missing-deps.js) 一律假设扁平的
	// .next/standalone/server.js，会导致找不到入口、静态资源 404。
	turbopack: {
		root: __dirname,
	},
	reactStrictMode: true,
	typedRoutes: true,
	devIndicators: false,
	// 注入版本信息到客户端环境变量
	env: {
		NEXT_PUBLIC_APP_VERSION: APP_VERSION,
		NEXT_PUBLIC_GIT_COMMIT: GIT_COMMIT,
		NEXT_PUBLIC_BUILD_TYPE: BUILD_TYPE,
	},
	// 增加代理超时时间到 120 秒，避免 LLM 调用超时
	experimental: {
		proxyTimeout: 120000, // 120 秒
	},
	// 在 Electron 环境中禁用 SSR，避免窗口显示问题
	// 注意：这会影响 SEO，但对于 Electron 应用来说不是问题
	...(process.env.ELECTRON === "true"
		? {
				// 可以在这里添加 Electron 特定的配置
			}
		: {}),
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${API_BASE_URL}/api/:path*`,
			},
			{
				source: "/assets/:path*",
				destination: `${API_BASE_URL}/assets/:path*`,
			},
			{
				source: "/uploads/:path*",
				destination: `${API_BASE_URL}/uploads/:path*`,
			},
		];
	},
	images: {
		// 允许全部本地路径带查询串（logo 等静态资源用 ?v=N 做缓存刷新）
		// 匹配所有本地路径、任意查询串（logo 用 ?v=N 做缓存刷新）
		localPatterns: [{ pathname: "/**" }],
		remotePatterns: [
			{
				protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
				hostname: apiUrl.hostname,
				port: apiUrl.port || undefined,
				pathname: "/api/**",
			},
		],
	},
};

export default withNextIntl(nextConfig);
