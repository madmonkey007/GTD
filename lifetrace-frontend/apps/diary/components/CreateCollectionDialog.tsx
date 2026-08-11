"use client";

import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { uploadJournalImage } from "@/lib/api";
import { compressImageIfNeeded } from "@/lib/imageCompress";
import { toastError } from "@/lib/toast";

interface CreateCollectionDialogProps {
	onClose: () => void;
	onCreated: (id: number) => void;
	createAsync: (input: {
		name?: string;
		description?: string | null;
		coverImageUrl?: string | null;
	}) => Promise<{ id: number } | null>;
	pending: boolean;
}

/** 新建集合弹窗：画廊页与侧边栏「集合」入口共用。 */
export function CreateCollectionDialog({
	onClose,
	onCreated,
	createAsync,
	pending,
}: CreateCollectionDialogProps) {
	const t = useTranslations("collection");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		try {
			const compressed = await compressImageIfNeeded(file);
			const res = await uploadJournalImage(compressed);
			setCoverUrl(res.url);
		} catch (err) {
			toastError(err instanceof Error ? err.message : t("coverUploadFailed"));
		}
	};

	const handleSubmit = async () => {
		if (!name.trim()) return;
		const created = await createAsync({
			name: name.trim(),
			description: description.trim() || null,
			coverImageUrl: coverUrl,
		});
		if (created) onCreated(created.id);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
			<div className="w-full max-w-md rounded-(--radius) bg-background shadow-xl">
				<div className="border-b border-border/40 px-4 py-3">
					<h3 className="text-sm font-semibold">{t("createTitle")}</h3>
				</div>
				<div className="space-y-3 p-4">
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t("namePlaceholder")}
						autoFocus
						className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={2}
						placeholder={t("descriptionPlaceholder")}
						className="w-full rounded-md border border-border/50 bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="flex h-24 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border/50 bg-muted/20 text-xs text-muted-foreground hover:bg-muted/30"
					>
						{coverUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={coverUrl} alt="" className="h-full w-full object-cover" />
						) : (
							<span className="flex items-center gap-1.5">
								<ImagePlus className="h-4 w-4" />
								{t("uploadCover")}
							</span>
						)}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleCover}
					/>
				</div>
				<div className="flex justify-end gap-2 border-t border-border/40 px-4 py-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/40"
					>
						{t("cancel")}
					</button>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={pending || !name.trim()}
						className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{t("create")}
					</button>
				</div>
			</div>
		</div>
	);
}
