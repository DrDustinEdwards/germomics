// Client-only image helpers (browser APIs). Downscale very large uploads before they hit R2 so
// we don't store needlessly huge originals (a light "auto-resize"). Falls back to the original
// file if anything goes wrong.
export async function downscaleImage(file: File, maxWidth = 2000): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  if (bitmap.width <= maxWidth) {
    bitmap.close?.();
    return file;
  }
  const scale = maxWidth / bitmap.width;
  const w = maxWidth;
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp" });
}
