"use client";

import { Library, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCollectionMutations, useCollections } from "@/lib/query";
import { CreateCollectionDialog } from "./CreateCollectionDialog";

interface CollectionGalleryProps {
	onSelectCollection: (id: number) => void;
}

export function CollectionGallery({ onSelectCollection }: CollectionGalleryProps) {
	const t = useTranslations("collection");
	const { data: collections = [], isLoading } = useCollections();
	const { createCollectionAsync, isPending } = useCollectionMutations();
	const [showCreate, setShowCreate] = useState(false);

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
				<h2 className="text-sm font-semibold">{t("galleryTitle")}</h2>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
				>
					<Plus className="h-3.5 w-3.5" />
					{t("create")}
				</button>
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				{isLoading ? null : collections.length === 0 ? (
					/* 空白页：中央一张大「+」卡片创建 */
					<div className="flex h-full flex-col items-center justify-center gap-4">
						<button
							type="button"
							onClick={() => setShowCreate(true)}
							className="flex h-40 w-64 flex-col items-center justify-center gap-2 rounded-(--radius) border-2 border-dashed border-border/50 text-muted-foreground/70 transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
						>
							<Plus className="h-8 w-8" />
							<span className="text-sm font-medium">{t("createFirst")}</span>
						</button>
						<p className="max-w-xs text-center text-xs text-muted-foreground/60">
							{t("emptyHint")}
						</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{collections.map((c) => (
							<button
								key={c.id}
								type="button"
								onClick={() => onSelectCollection(c.id)}
								className="group flex flex-col overflow-hidden rounded-(--radius) bg-[oklch(var(--card))] text-left shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] transition-transform hover:-translate-y-0.5"
							>
								<div className="aspect-[4/3] w-full bg-muted/40">
									{c.coverImageUrl ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={c.coverImageUrl}
											alt=""
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
											<Library className="h-6 w-6" />
										</div>
									)}
								</div>
								<div className="p-2.5">
									<div className="truncate text-sm font-medium">{c.name}</div>
									<div className="mt-0.5 text-[11px] text-muted-foreground">
										{t("notesCount", { count: c.noteCount })}
									</div>
								</div>
							</button>
						))}
						{/* 末尾一张「+」卡片新建 */}
						<button
							type="button"
							onClick={() => setShowCreate(true)}
							className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-(--radius) border-2 border-dashed border-border/50 text-muted-foreground/60 transition-colors hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
						>
							<Plus className="h-6 w-6" />
							<span className="text-xs">{t("create")}</span>
						</button>
					</div>
				)}
			</div>

			{showCreate && (
				<CreateCollectionDialog
					onClose={() => setShowCreate(false)}
					onCreated={(id) => {
						setShowCreate(false);
						onSelectCollection(id);
					}}
					createAsync={createCollectionAsync}
					pending={isPending}
				/>
			)}
		</div>
	);
}
