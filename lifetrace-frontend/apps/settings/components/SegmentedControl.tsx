"use client";

import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
	value: T;
	label: string;
}

interface SegmentedControlProps<T extends string> {
	options: SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	ariaLabel?: string;
}

/**
 * 分段选择控件：始终显示当前选中值，移动端触控友好。
 * 激活段采用「抬升」样式（背景卡片 + 轻阴影），与 tab 导航的实心主色区分。
 */
export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	ariaLabel,
}: SegmentedControlProps<T>) {
	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5"
		>
			{options.map((option) => {
				const isActive = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={isActive}
						onClick={() => onChange(option.value)}
						className={cn(
							"rounded-md px-2.5 py-1 text-xs font-medium transition",
							"active:scale-[0.97]",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							isActive
								? "bg-background text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
