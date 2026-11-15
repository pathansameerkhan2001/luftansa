/**
 * Upload limits shared by the admin client and the upload API.
 *
 * Uploads go through the same-origin /api/admin/media/upload route, which runs
 * as a Vercel Function. Vercel rejects request bodies above ~4.5 MB, so images
 * are compressed in the browser to at most MAX_UPLOAD_BYTES before upload.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB (below Vercel's 4.5 MB body limit, incl. multipart overhead)
/** Largest original photo the admin will attempt to compress in the browser. */
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024; // 40 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
