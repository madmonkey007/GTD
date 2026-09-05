import { cn } from "@/lib/utils";

interface SubTaskIconProps {
	className?: string;
}

/** 任务拆分/子任务图标（自定义 SVG，viewBox 1024） */
export function SubTaskIcon({ className }: SubTaskIconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 1024 1024"
			fill="currentColor"
			className={cn("h-4 w-4", className)}
			aria-hidden="true"
		>
			<path d="M198.57 59.733a42.667 42.667 0 0 1 42.667 42.667v193.365h314.027a159.403 159.403 0 1 1 0 85.334H241.237v82.517a298.667 298.667 0 0 0 298.667 298.667h15.36a159.403 159.403 0 1 1 0 85.333h-15.36a384 384 0 0 1-384-384v-124.16a43.947 43.947 0 0 1 0-2.048V102.4a42.667 42.667 0 0 1 42.667-42.667z m510.294 204.715a73.984 73.984 0 1 0 0 147.968 73.984 73.984 0 0 0 0-147.968z m0 466.517a73.984 73.984 0 1 0 0 147.968 73.984 73.984 0 0 0 0-147.968z" />
		</svg>
	);
}
