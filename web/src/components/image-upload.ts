// Client-side image checks + downscaling before upload to Supabase Storage.
// The buckets enforce type and size limits too; this gives fast, friendly errors.

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function checkImage(file: File, maxMb: number): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Позволени са само JPG, PNG и WEBP снимки.";
  if (file.size > maxMb * 1024 * 1024 * 3) return `Снимката е твърде голяма (макс. ${maxMb} MB след оптимизация).`;
  return null;
}

/** Downscale to maxSide and re-encode as WEBP (falls back to the original file). */
export async function shrinkImage(file: File, maxSide: number, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
