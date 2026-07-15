"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, X } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, QUESTION_BANK } from "../question-bank";

interface InspirationBankProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (question: string) => void;
}

export function InspirationBank({
	isOpen,
	onClose,
	onSelect,
}: InspirationBankProps) {
	const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);

	const filteredQuestions = QUESTION_BANK.filter(
		(q) => q.category === activeCategory,
	);

	const handleSelect = (question: string) => {
		onSelect(question);
		onClose();
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-background/80 z-50"
						onClick={onClose}
					/>

					{/* Drawer */}
					<motion.div
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", damping: 25, stiffness: 200 }}
						className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-border z-50 flex flex-col"
					>
						{/* Header */}
						<div className="flex items-center justify-between p-6 border-b border-border">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 rounded-lg">
									<BookOpen size={18} strokeWidth={1.5} className="text-primary" />
								</div>
								<h2 className="text-sm font-semibold tracking-tight text-foreground">
									灵感题库
								</h2>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="p-2 text-muted-foreground hover:text-foreground transition-colors"
							>
								<X size={18} strokeWidth={1.5} />
							</button>
						</div>

						{/* Category tabs */}
						<div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
							{CATEGORIES.map((cat) => (
								<button
									type="button"
									key={cat.id}
									onClick={() => setActiveCategory(cat.id)}
								className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all duration-200 ${
									activeCategory === cat.id
										? "bg-primary/10 text-primary font-medium"
										: "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
								}`}
								>
									{cat.label}
								</button>
							))}
						</div>

						{/* Questions list */}
						<div className="flex-1 overflow-y-auto p-4 space-y-2">
							{filteredQuestions.map((q, index) => (
								<motion.button
									key={q.id}
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: index * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
									onClick={() => handleSelect(q.question)}
									className="w-full text-left p-3 bg-card hover:bg-muted border border-border hover:border-border rounded-lg transition-all duration-200 group"
								>
									<p className="text-sm text-foreground group-hover:text-foreground transition-colors duration-300">
										{q.question}
									</p>
									<p className="text-xs text-muted-foreground mt-2">
										{q.categoryLabel}
									</p>
								</motion.button>
							))}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
