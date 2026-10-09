// Client-side image checks + downscaling before upload to Supabase Storage.
// The buckets enforce type and size limits too; this gives fast, friendly errors.

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function checkImage(file: File, maxMb: number): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Позволени са само JPG, PNG и WEBP снимки.";
  if (file.size > maxMb * 1024 * 1024 * 3) return `Снимката е твърде голяма (макс. ${maxMb} MB след оптимизация).`;
  return null;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** File extension that matches what the blob really is. */
export const imageExt = (blob: Blob) => (blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg");

/**
 * Downscale to maxSide and re-encode as WEBP (JPEG where the browser cannot encode WEBP).
 * The picture is always redrawn on a canvas, never uploaded as it was taken: that drops the metadata,
 * including the GPS position a phone camera writes into the photo of a client's home.
 * Throws for a JPEG that cannot be re-encoded, instead of uploading its metadata.
 */
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
    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) throw new Error("encode");
    return blob;
  } catch {
    if (file.type === "image/jpeg") throw new Error("Снимката не може да се обработи. Опитайте с друга.");
    return file;
  }
}
