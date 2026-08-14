"use client";

import { Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { uploadJournalImage } from "@/lib/api";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** 生成器可选的背景色（来自 claude_card_maker.html） */
const COVER_COLORS = [
	{ name: "Peach", hex: "#ebc9b7" },
	{ name: "Sky", hex: "#6a9bcc" },
	{ name: "Olive", hex: "#788c5d" },
	{ name: "Heather", hex: "#cbcadb" },
	{ name: "Mineral", hex: "#629987" },
	{ name: "Cactus", hex: "#bcd1ca" },
	{ name: "Plum", hex: "#827dbd" },
	{ name: "Clay", hex: "#d97757" },
];

const RATIOS = [
	{ v: "3/4", label: "3:4", pure: false },
	{ v: "1/1", label: "1:1", pure: true },
	{ v: "2.35/1", label: "2.35:1", pure: true },
] as const;

const RATIO_PARTS: Record<string, [number, number]> = {
	"3/4": [3, 4],
	"1/1": [1, 1],
	"2.35/1": [47, 20],
};

/** 78 张插图（public/collection-illustrations/001.svg … 078.svg） */
const ILLUSTRATIONS = Array.from(
	{ length: 78 },
	(_, i) => `/collection-illustrations/${String(i + 1).padStart(3, "0")}.svg`,
);

const FONTS: { value: string; label: string }[] = [
	{ value: "'PingFang SC','Microsoft YaHei',sans-serif", label: "默认字体" },
	{ value: "'Ma Shan Zheng',cursive", label: "马善政楷书" },
	{ value: "'Zhi Mang Xing',cursive", label: "志莽行书" },
	{ value: "'Long Cang',cursive", label: "龙藏体" },
	{ value: "'ZCOOL KuaiLe',cursive", label: "ZCOOL 快乐体" },
	{ value: "'ZCOOL QingKe HuangYou',sans-serif", label: "ZCOOL 清刻黄油" },
	{ value: "'ZCOOL XiaoWei',serif", label: "ZCOOL 小薇体" },
];

/**
 * html2canvas 1.4.1 无法解析 oklch()（Tailwind v4 / WebKit 下 getComputedStyle
 * 仍返回 oklch 原值）。导出前在克隆文档里把每个元素的 color / background-color 等
 * 含 oklch 的计算值替换成 rgb 内联样式（!important），只影响本次导出。
 */
function oklchToRgb(inner: string): string {
	const parts = inner.trim().split(/\s+/);
	const L = Math.min(1, Math.max(0, parseFloat(parts[0] ?? "0")));
	const a = (parseFloat(parts[1] ?? "0")) * 0.4;
	const b = (parseFloat(parts[2] ?? "0")) * 0.4;
	const alpha = parts[3] === "/" ? parseFloat(parts[4] ?? "") : null;
	const fy = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const fx = (-0.10616598 * a - 0.15234849 * b + fy) ** 3;
	const fz = (-0.73025048 * a + 1.0 * b + fy) ** 3;
	const toLin = (v: number) => (v > 0.2068965517 ? v ** 3 : 0.1284185953 * v - 0.0177129034);
	const gam = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
	const R = Math.round(Math.min(1, Math.max(0, gam(toLin(fx) * 3.2404542 + toLin(fy) * -1.5371385 + toLin(fz) * -0.4985314))) * 255);
	const G = Math.round(Math.min(1, Math.max(0, gam(toLin(fx) * -0.969266 + toLin(fy) * 1.8760108 + toLin(fz) * 0.041556))) * 255);
	const B = Math.round(Math.min(1, Math.max(0, gam(toLin(fx) * 0.0556434 + toLin(fy) * -0.2040259 + toLin(fz) * 1.0572252))) * 255);
	return alpha != null ? `rgba(${R},${G},${B},${alpha})` : `rgb(${R},${G},${B})`;
}

function stripOklchFromClone(doc: Document) {
	const win = doc.defaultView;
	if (!win) return;
	const COLOR_PROPS = [
		"color",
		"background-color",
		"border-color",
		"border-top-color",
		"border-right-color",
		"border-bottom-color",
		"border-left-color",
		"outline-color",
		"text-decoration-color",
		"fill",
		"stroke",
		"box-shadow",
	];
	doc.querySelectorAll("*").forEach((node) => {
		const el = node as HTMLElement;
		const cs = win.getComputedStyle(node);
		for (const prop of COLOR_PROPS) {
			const val = cs.getPropertyValue(prop);
			if (val && val.includes("oklch")) {
				const replaced = val.replace(/oklch\(\s*([^)]+)\)/g, (_, g1) => oklchToRgb(g1));
				el.style.setProperty(prop, replaced, "important");
			}
		}
	});
}

interface CoverGeneratorModalProps {
	collectionName: string;
	onCancel: () => void;
	/** 生成成功后回调图片 url */
	onGenerated: (coverUrl: string) => void;
}

export function CoverGeneratorModal({
	collectionName,
	onCancel,
	onGenerated,
}: CoverGeneratorModalProps) {
	const t = useTranslations("collection");
	const cardRef = useRef<HTMLDivElement>(null);
	const [ratio, setRatio] = useState<string>("3/4");
	const [colorIdx, setColorIdx] = useState(0);
	const [imgIdx, setImgIdx] = useState(0);
	const [font, setFont] = useState(FONTS[0].value);
	const [title, setTitle] = useState(collectionName);
	const [sign, setSign] = useState("");
	const [titleSize, setTitleSize] = useState(48);
	const [generating, setGenerating] = useState(false);

	const ratioDef = RATIOS.find((r) => r.v === ratio)!;
	const pure = !!ratioDef.pure;
	const color = COVER_COLORS[colorIdx];

	// 注入生成器用到的 Google 字体
	useEffect(() => {
		const id = "cover-generator-fonts";
		if (document.getElementById(id)) return;
		const link = document.createElement("link");
		link.id = id;
		link.rel = "stylesheet";
		link.href =
			"https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Zhi+Mang+Xing&family=Long+Cang&family=ZCOOL+KuaiLe&family=ZCOOL+QingKe+HuangYou&family=ZCOOL+XiaoWei&display=swap";
		document.head.appendChild(link);
		return () => document.getElementById(id)?.remove();
	}, []);

	const handleGenerate = async () => {
		const el = cardRef.current;
		if (!el || generating) return;
		setGenerating(true);
		try {
			if (document.fonts && document.fonts.ready) {
				try {
					await document.fonts.ready;
				} catch {
					/* 忽略 */
				}
			}
			const parts = RATIO_PARTS[ratio] ?? [3, 4];
			const m = Math.max(1, Math.round(1200 / parts[0]));
			const W = parts[0] * m;
			const H = parts[1] * m;
			const prevW = el.style.width;
			const prevH = el.style.height;
			el.style.width = `${W}px`;
			el.style.height = `${H}px`;
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

			const html2canvas = (await import("html2canvas")).default;
			const canvas = await html2canvas(el, {
				scale: 2,
				backgroundColor: "#ffffff",
				useCORS: true,
				logging: false,
				width: W,
				height: H,
				onclone: (doc) => stripOklchFromClone(doc),
			});
			el.style.width = prevW;
			el.style.height = prevH;

			const dataUrl = canvas.toDataURL("image/png");
			const blob = await (await fetch(dataUrl)).blob();
			const file = new File([blob], "cover.png", { type: "image/png" });
			const res = await uploadJournalImage(file);
			onGenerated(res.url);
		} catch (err) {
			console.error("生成封面失败:", err);
			toastError(t("coverUploadFailed"));
			// 还原尺寸
			const el2 = cardRef.current;
			if (el2) {
				el2.style.width = "";
				el2.style.height = "";
			}
		} finally {
			setGenerating(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-(--radius) bg-background shadow-2xl">
				{/* 顶栏 */}
				<div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-2.5">
					<h3 className="text-sm font-semibold">{t("generateCover")}</h3>
					<button
						type="button"
						onClick={onCancel}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40"
						aria-label={t("close")}
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="flex min-h-0 flex-1">
					{/* 左侧控制区 */}
					<div className="w-72 shrink-0 overflow-y-auto border-r border-border/40 p-4">
						{/* 比例 */}
						<div className="mb-5">
							<div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
								{t("ratio")}
							</div>
							<div className="flex gap-1.5">
								{RATIOS.map((r) => (
									<button
										key={r.v}
										type="button"
										onClick={() => setRatio(r.v)}
										className={cn(
											"flex-1 rounded-md border border-border/50 px-2 py-1.5 text-xs transition-colors",
											ratio === r.v
												? "bg-foreground text-background"
												: "text-muted-foreground hover:bg-muted/40",
										)}
									>
										{r.label}
									</button>
								))}
							</div>
						</div>

						{/* 背景色 */}
						<div className="mb-5">
							<div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
								{t("color")}
							</div>
							<div className="grid grid-cols-4 gap-2">
								{COVER_COLORS.map((c, i) => (
									<button
										key={c.hex}
										type="button"
										title={c.name}
										onClick={() => setColorIdx(i)}
										className={cn(
											"flex aspect-[2/1] items-end justify-center rounded-md border-2 transition-all",
											colorIdx === i
												? "border-foreground shadow-[0_0_0_3px_rgba(217,119,87,0.3)]"
												: "border-transparent hover:border-border",
										)}
										style={{ background: c.hex }}
									>
										<span className="mb-0.5 text-[9px] text-black/40">{c.name}</span>
									</button>
								))}
							</div>
						</div>

						{/* 插图 */}
						<div className="mb-5">
							<div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
								{t("illustration")}
							</div>
							<div className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto p-1">
								{ILLUSTRATIONS.map((src, i) => (
									<button
										key={src}
										type="button"
										onClick={() => setImgIdx(i)}
										title={`#${i + 1}`}
										className={cn(
											"aspect-square overflow-hidden rounded-md border-2 transition-all",
											imgIdx === i
												? "border-[#d97757] shadow-[0_0_0_3px_rgba(217,119,87,0.3)]"
												: "border-border/50 hover:border-border",
										)}
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img src={src} alt="" className="h-full w-full object-contain" />
									</button>
								))}
							</div>
						</div>

						{/* 字体 */}
						<div className="mb-5">
							<div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
								{t("font")}
							</div>
							<select
								value={font}
								onChange={(e) => setFont(e.target.value)}
								className="h-8 w-full rounded-md border border-border/50 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
							>
								{FONTS.map((f) => (
									<option key={f.value} value={f.value}>
										{f.label}
									</option>
								))}
							</select>
						</div>

						{/* 文案（pure 模式隐藏） */}
						{!pure && (
							<div className="mb-5">
								<div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
									{t("text")}
								</div>
								<div className="mb-2">
									<label className="mb-1 block text-xs text-muted-foreground">
										{t("title")}
									</label>
									<input
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										className="h-8 w-full rounded-md border border-border/50 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
									/>
								</div>
								<div className="mb-2">
									<label className="mb-1 block text-xs text-muted-foreground">
										{t("sign")}
									</label>
									<input
										value={sign}
										onChange={(e) => setSign(e.target.value)}
										placeholder={t("signPlaceholder")}
										className="h-8 w-full rounded-md border border-border/50 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
									/>
								</div>
								<div className="flex items-center gap-2">
									<label className="text-xs text-muted-foreground">
										{t("titleSize")}
									</label>
									<button
										type="button"
										onClick={() => setTitleSize((s) => Math.max(48, s - 2))}
										disabled={titleSize <= 48}
										className="flex h-6 w-6 items-center justify-center rounded border border-border/60 disabled:opacity-40"
									>
										<Minus className="h-3 w-3" />
									</button>
									<span className="min-w-8 text-center text-sm font-semibold">
										{titleSize}
									</span>
									<button
										type="button"
										onClick={() => setTitleSize((s) => Math.min(80, s + 2))}
										disabled={titleSize >= 80}
										className="flex h-6 w-6 items-center justify-center rounded border border-border/60 disabled:opacity-40"
									>
										<Plus className="h-3 w-3" />
									</button>
								</div>
							</div>
						)}

						<button
							type="button"
							onClick={handleGenerate}
							disabled={generating}
							className="w-full rounded-md bg-[#d97757] px-3 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-105 active:translate-y-px disabled:opacity-60"
						>
							{generating ? t("generating") : t("generateBtn")}
						</button>
					</div>

					{/* 右侧预览 */}
					<div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/30 p-8">
						<CoverPreviewCard
							cardRef={cardRef}
							ratio={ratio}
							color={color.hex}
							img={ILLUSTRATIONS[imgIdx]}
							font={font}
							pure={pure}
							title={title}
							sign={sign}
							titleSize={titleSize}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

/** 预览卡片：内联样式复刻原生成器的 .card 结构（html2canvas 直接导出此元素） */
const CoverPreviewCard = ({
	cardRef,
	ratio,
	color,
	img,
	font,
	pure,
	title,
	sign,
	titleSize,
}: {
	cardRef: React.Ref<HTMLDivElement>;
	ratio: string;
	color: string;
	img: string;
	font: string;
	pure: boolean;
	title: string;
	sign: string;
	titleSize: number;
}) => {
	const parts = RATIO_PARTS[ratio] ?? [3, 4];
	const m = Math.max(1, Math.round(1200 / parts[0]));
	const W = parts[0] * m;
	const H = parts[1] * m;
	const scale = Math.min(1, 460 / W, 560 / H);
	return (
		<div
			ref={cardRef}
			style={{
				width: W * scale,
				height: H * scale,
				background: "#fff",
				borderRadius: ratio === "2.35/1" ? 0 : 16,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				fontFamily: font,
				boxShadow: "0 14px 50px rgba(0,0,0,0.13)",
				flex: "none",
			}}
		>
			<div
				style={{
					height: pure ? "100%" : "70%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: pure ? "5%" : "7% 9%",
					background: color,
				}}
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={img} alt="" style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain" }} />
			</div>
			{!pure && (
				<div
					style={{
						flex: 1,
						background: "#fff",
						padding: "7% 8.5%",
						display: "flex",
						flexDirection: "column",
						gap: "2.4%",
						overflow: "hidden",
						minHeight: 0,
					}}
				>
					<div style={{ fontSize: 24 * scale, color: "#9a9a9a", letterSpacing: "0.6px" }}>
						{new Date().toLocaleDateString("zh-CN", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</div>
					<div
						style={{
							fontSize: titleSize * scale,
							fontWeight: 800,
							lineHeight: 1.28,
							color: "#1d1d1f",
							margin: "auto 0",
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}}
					>
						{title}
					</div>
					<div style={{ alignSelf: "flex-end", fontSize: 24 * scale, color: "#9a9a9a" }}>
						{sign}
					</div>
				</div>
			)}
		</div>
	);
};
