// 客户端图片压缩：仅在原图超过阈值时触发，尽量视觉无损。
// 用 createImageBitmap + canvas 重新编码为 WebP（支持透明、压缩比好），
// 浏览器不支持 WebP 时回退 JPEG。失败时返回原文件，不阻断上传。

const DEFAULT_THRESHOLD = 500 * 1024; // 500KB
const DEFAULT_MAX_DIM = 1920; // 最长边像素上限
const DEFAULT_QUALITY = 0.92; // 视觉接近无损

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * 仅当 file.size > threshold 时压缩；否则原样返回。
 * 返回值始终是 File（压缩失败也回退为原 file）。
 */
export async function compressImageIfNeeded(
	file: File,
	threshold: number = DEFAULT_THRESHOLD,
	maxDim: number = DEFAULT_MAX_DIM,
	quality: number = DEFAULT_QUALITY,
): Promise<File> {
	if (file.size <= threshold) return file;

	try {
		const bitmap = await createImageBitmap(file);
		let { width, height } = bitmap;
		if (Math.max(width, height) > maxDim) {
			const scale = maxDim / Math.max(width, height);
			width = Math.round(width * scale);
			height = Math.round(height * scale);
		}

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return file;
		ctx.drawImage(bitmap, 0, 0, width, height);
		bitmap.close?.();

		// 优先 WebP，不支持时回退 JPEG
		let blob = await canvasToBlob(canvas, "image/webp", quality);
		let ext = ".webp";
		if (!blob) {
			blob = await canvasToBlob(canvas, "image/jpeg", quality);
			ext = ".jpg";
		}
		if (!blob) return file;

		const stem = file.name.replace(/\.[^.]+$/, "") || "image";
		return new File([blob], `${stem}${ext}`, { type: blob.type, lastModified: Date.now() });
	} catch {
		return file;
	}
}
