export const MAX_PHOTOS_PER_ENTRY = 10;

const FULL_DIM = 1280;
const FULL_QUALITY = 0.8;
const THUMB_DIM = 400;
const THUMB_QUALITY = 0.65;

export type PhotoInput = { file: File; preview: string };

// Downscale an image so its longest side is ≤ maxDim and re-encode as JPEG to
// shrink the file. Non-images (e.g. PDF receipts) pass through, and on any
// failure the original file is kept. Browser-only (uses canvas).
async function shrinkImage(
  file: File,
  maxDim = FULL_DIM,
  quality = FULL_QUALITY,
): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!dataUrl) return file;

    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = document.createElement("img");
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = dataUrl;
    });
    if (!img?.width || !img?.height) return file;

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // White matte so transparent PNGs don't render black as JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Resize each photo into a full + thumbnail variant in the browser, then hand
// both to the server upload proxy (/api/receipt/upload). The server authorizes
// the caller, enforces MAX_PHOTOS_PER_ENTRY, writes to R2, and inserts the
// time_log_photos rows. Storage credentials never reach the browser.
export async function uploadPhotos(timeLogId: string, photos: PhotoInput[]) {
  if (photos.length === 0) return;

  const form = new FormData();
  form.set("timeLogId", timeLogId);

  let count = 0;
  for (const { file } of photos) {
    const full = await shrinkImage(file);
    form.append(`full_${count}`, full, full.name);
    // Small thumbnail variant for list views / PDF embeds (served via ?thumb=1).
    // Only sent when it's actually smaller than the full image; otherwise the
    // server/serve route falls back to the full image.
    const thumb = await shrinkImage(file, THUMB_DIM, THUMB_QUALITY);
    if (thumb !== full) form.append(`thumb_${count}`, thumb, thumb.name);
    count++;
  }
  form.set("count", String(count));

  await fetch("/api/receipt/upload", { method: "POST", body: form });
}

// Derive the thumbnail object key from a full-image key (UUID-based, so the
// thumbnail sits next to the original). Pure function — safe on server or client.
export function thumbStoragePath(storagePath: string): string {
  return storagePath.replace(/(\.[^.]+)$/, "_thumb$1");
}

// Delete a photo (R2 objects + metadata row) via the server proxy, which
// authorizes the caller against the photo's owner.
export async function deletePhoto(photoId: string) {
  await fetch(`/api/receipt/${photoId}`, { method: "DELETE" });
}
