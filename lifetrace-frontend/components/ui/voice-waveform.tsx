"use client";

/**
 * 语音录音波纹：一排错相位伸缩的细竖条。
 * 纯 CSS 动画（voice-wave-bar 定义于 globals.css），
 * 条数与颜色由调用方决定，录音展开态按钮内自适应铺满。
 */
export function VoiceWaveform({
	bars = 22,
	className = "h-4",
	barClassName = "bg-red-500/80",
}: {
	bars?: number;
	className?: string;
	barClassName?: string;
}) {
	return (
		<span
			aria-hidden={true}
			className={`flex items-center gap-[3px] overflow-hidden ${className}`}
		>
			{Array.from({ length: bars }, (_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: 装饰性动画条无需稳定 key
					key={i}
					className={`
						w-[3px] h-full origin-center rounded-full
						animate-[voice-wave-bar_0.9s_ease-in-out_infinite]
						${barClassName}
					`}
					style={{ animationDelay: `${(i % 11) * 90}ms` }}
				/>
			))}
		</span>
	);
}
