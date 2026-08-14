import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { cn } from "@/lib/utils";

interface TodoCardExpandButtonProps {
	hasChildren: boolean;
	isExpanded: boolean;
	onToggle: () => void;
}

export function TodoCardExpandButton({
	hasChildren,
	isExpanded,
	onToggle,
}: TodoCardExpandButtonProps) {
	const tTodoDetail = useTranslations("todoDetail");
	const isMobile = useIsMobile();

	if (!hasChildren) {
		return <div className={cn("w-4 shrink-0", isMobile && "w-6")} />;
	}

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onToggle();
			}}
			className={cn(
				"shrink-0 flex items-center justify-center rounded-md hover:bg-muted/50 transition-colors self-start mt-1",
				isMobile ? "h-9 w-9 rounded-lg" : "h-4 w-4",
			)}
			aria-label={
				isExpanded
					? tTodoDetail("collapseSubTasks")
					: tTodoDetail("expandSubTasks")
			}
		>
			<ChevronRight
				className={cn(
					"h-3 w-3 text-muted-foreground transition-transform duration-200",
					isExpanded && "rotate-90",
					isMobile && "h-4 w-4",
				)}
			/>
		</button>
	);
}
