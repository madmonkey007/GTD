"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

/**
 * 笔记卡片 markdown 渲染：支持列表、粗体、标题等，#tag 经 rehypeRaw 渲染为标签 chip；
 * 连续 ≥2 张图片行渲染为九宫格，散落单张仍走 ReactMarkdown。
 * 从 DiaryEditor 抽出，供笔记列表与项目笔记页共用，保证视觉一致。
 */

function NoteImage({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) {
	const [zoom, setZoom] = useState(false);
	return (
		<>
			<img
				src={src}
				alt={alt ?? ""}
				onClick={(e) => {
					e.stopPropagation();
					setZoom(true);
				}}
				className="block w-[120px] h-[120px] object-cover rounded my-1 cursor-zoom-in"
			/>
			{zoom &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						onClick={(e) => {
							e.stopPropagation();
							setZoom(false);
						}}
						className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center cursor-zoom-out"
					>
						<img
							src={src}
							alt={alt ?? ""}
							className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
						/>
					</div>,
					document.body,
				)}
		</>
	);
}

export function NoteMarkdown({ content }: { content: string }) {
	const segments = useMemo(() => segmentContent(content), [content]);
	return (
		<div className="text-sm text-muted-foreground leading-relaxed space-y-1">
			{segments.map((seg, i) =>
				seg.type === "images" ? (
					<NoteImageGrid key={i} images={seg.images} />
				) : (
					<TextBlock key={i} text={seg.text} />
				),
			)}
		</div>
	);
}

/** 文本段：#tag 预处理 + ReactMarkdown 渲染 */
function TextBlock({ text }: { text: string }) {
	const processed = text.replace(
		/#(\S+)/g,
		'<span class="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground align-middle">#$1</span>',
	);
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			rehypePlugins={[rehypeRaw]}
			components={{
				p: ({ children }: { children?: React.ReactNode }) => (
					<p className="my-0 leading-relaxed">{children}</p>
				),
				ul: ({ children }: { children?: React.ReactNode }) => (
					<ul className="my-0 list-disc pl-4 space-y-0">{children}</ul>
				),
				ol: ({ children }: { children?: React.ReactNode }) => (
					<ol className="my-0 list-decimal pl-4 space-y-0">{children}</ol>
				),
				li: ({ children }: { children?: React.ReactNode }) => (
					<li className="leading-relaxed">{children}</li>
				),
				strong: ({ children }: { children?: React.ReactNode }) => (
					<strong className="font-semibold">{children}</strong>
				),
				em: ({ children }: { children?: React.ReactNode }) => (
					<em className="italic">{children}</em>
				),
				h1: ({ children }: { children?: React.ReactNode }) => (
					<h1 className="text-xs font-bold mb-0.5">{children}</h1>
				),
				h2: ({ children }: { children?: React.ReactNode }) => (
					<h2 className="text-xs font-semibold mb-0.5">{children}</h2>
				),
				h3: ({ children }: { children?: React.ReactNode }) => (
					<h3 className="text-[11px] font-semibold mb-0.5">{children}</h3>
				),
				code: ({ children }: { children?: React.ReactNode }) => (
					<code className="px-1 py-0.5 rounded text-[11px] font-mono bg-muted/40">{children}</code>
				),
				img: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => (
					<NoteImage src={src} alt={alt ?? ""} />
				),
			}}
		>
			{processed}
		</ReactMarkdown>
	);
}

const IMG_TOKEN_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const GRID_MAX = 9;

type Segment =
	| { type: "text"; text: string }
	| { type: "images"; images: { src: string; alt: string }[] };

/** 提取一行中的全部图片；仅当该行除图片与空白外无其它内容时返回非空数组。 */
function extractLineImages(line: string): { src: string; alt: string }[] | null {
	const matches = [...line.matchAll(IMG_TOKEN_RE)];
	if (matches.length === 0) return null;
	const stripped = line.replace(IMG_TOKEN_RE, "").trim();
	if (stripped !== "") return null;
	return matches.map((m) => ({ alt: m[1], src: m[2] }));
}

/** 切分：连续 ≥2 张图片行 → images 段；其余累积为 text 段 */
function segmentContent(content: string): Segment[] {
	const lines = content.split(/\r?\n/);
	const segs: Segment[] = [];
	let textBuf: string[] = [];
	let imgBuf: { src: string; alt: string }[] = [];

	const flushImages = () => {
		if (imgBuf.length >= 2) {
			segs.push({ type: "images", images: imgBuf });
		} else {
			textBuf.push(...imgBuf.map((im) => `![${im.alt}](${im.src})`));
		}
		imgBuf = [];
	};
	const flushText = () => {
		if (textBuf.length > 0) {
			segs.push({ type: "text", text: textBuf.join("\n") });
			textBuf = [];
		}
	};

	for (const line of lines) {
		const lineImgs = extractLineImages(line);
		if (lineImgs) {
			flushText();
			imgBuf.push(...lineImgs);
		} else {
			flushImages();
			textBuf.push(line);
		}
	}
	flushImages();
	flushText();
	return segs;
}

/** 九宫格：每行最多 3 张；超过 9 张，第 9 格叠加「+N 查看更多」。点格放大单图。 */
function NoteImageGrid({ images }: { images: { src: string; alt: string }[] }) {
	const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
	const overflow = Math.max(0, images.length - GRID_MAX);
	const shown = images.slice(0, GRID_MAX);
	return (
		<div className="my-1 grid grid-cols-3 gap-1 max-w-[380px]">
			{shown.map((im, i) => {
				const isMoreCell = overflow > 0 && i === GRID_MAX - 1;
				return (
					<button
						key={`${im.src}-${i}`}
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setZoom(im);
						}}
						className="relative aspect-square w-full overflow-hidden rounded bg-muted/30"
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={im.src}
							alt={im.alt}
							className="h-full w-full object-cover"
						/>
						{isMoreCell && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-semibold text-white">
								+{overflow} 查看更多
							</div>
						)}
					</button>
				);
			})}
			{zoom &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						onClick={(e) => {
							e.stopPropagation();
							setZoom(null);
						}}
						className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 cursor-zoom-out"
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={zoom.src}
							alt={zoom.alt}
							className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
						/>
					</div>,
					document.body,
				)}
		</div>
	);
}
