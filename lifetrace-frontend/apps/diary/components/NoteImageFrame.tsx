"use client";

import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ImageState = "loading" | "ok" | "error";

/**
 * 带加载占位的图片：加载中显示骨架底 + 图片图标（呼吸动画），
 * 失败显示「图片加载失败」错误态；加载成功后只留图片本身。
 * 尺寸由 className 控制，img 始终铺满容器。
 */
export function NoteImageFrame({
	src,
	alt = "",
	className = "",
	imgClassName = "",
	onClick,
	title,
}: {
	src: string;
	alt?: string;
	className?: string;
	imgClassName?: string;
	onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
	title?: string;
}) {
	const [state, setState] = useState<ImageState>("loading");

	useEffect(() => {
		setState("loading");
	}, [src]);

	const handleLoad = useCallback(() => setState("ok"), []);
	const handleError = useCallback(() => setState("error"), []);

	return (
		<span
			className={cn("relative block overflow-hidden bg-muted/40", className)}
			onClick={onClick}
			role={onClick ? "button" : undefined}
			title={title}
		>
			{/* biome-ignore lint/a11y/useAltText: alt 由调用方传入 */}
			{/* biome-ignore lint/performance/noImgElement: 笔记内容图片由后端相对路径提供，不走 next/image */}
			<img
				src={src}
				alt={alt}
				draggable={false}
				onLoad={handleLoad}
				onError={handleError}
				className={cn("block h-full w-full", state === "ok" ? "" : "opacity-0", imgClassName)}
			/>
			{state !== "ok" && (
				<span className="absolute inset-0 flex items-center justify-center" aria-hidden={true}>
					{state === "loading" ? (
						<>
							<span className="absolute inset-0 animate-pulse bg-muted/70" />
							<ImageIcon className="relative h-6 w-6 text-muted-foreground/30" />
						</>
					) : (
						<span className="flex flex-col items-center gap-1 p-1 text-muted-foreground/50">
							<ImageOff className="h-4 w-4" />
							<span className="text-[10px] leading-none">图片加载失败</span>
						</span>
					)}
				</span>
			)}
		</span>
	);
}
