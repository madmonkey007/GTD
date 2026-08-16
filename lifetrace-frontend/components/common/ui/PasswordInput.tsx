"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type Ref } from "react";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	inputRef?: Ref<HTMLInputElement>;
}

/** 密码输入框，右侧带显示/隐藏切换的眼睛按钮 */
export function PasswordInput({ inputRef, className, ...props }: PasswordInputProps) {
	const [visible, setVisible] = useState(false);

	return (
		<div className="relative">
			<input
				{...props}
				ref={inputRef}
				type={visible ? "text" : "password"}
				className={`${className ?? ""} pr-9`}
			/>
			<button
				type="button"
				onClick={() => setVisible((v) => !v)}
				tabIndex={-1}
				title={visible ? "隐藏密码" : "显示密码"}
				aria-label={visible ? "隐藏密码" : "显示密码"}
				className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
			>
				{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
			</button>
		</div>
	);
}
