/**
 * Upload rules for the Media Library and product images (pure; shared by the
 * admin client and the upload API).
 *
 * Size limits come from the real infrastructure: uploads pass through a
 * Vercel Function, which rejects request bodies above ~4.5 MB, and the bucket
 * has no CORS rule, so direct browser-to-S3 uploads are not possible yet.
 * Images are compressed in the browser to fit. Larger videos need the
 * reviewed S3 CORS rule (docs/s3-cors-proposal.md); until it is approved the
 * video limit stays at the same 4 MB.
 */
import { MAX_UPLOAD_BYTES } from "./upload-limits";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export type UploadKind = "image" | "video";

export const MAX_IMAGE_BYTES = MAX_UPLOAD_BYTES;
export const MAX_VIDEO_BYTES = MAX_UPLOAD_BYTES;

/** Media Library destinations (each maps to an allow-listed bucket folder). */
export const LIBRARY_FOLDERS = ["general", "hero", "banners", "about", "lab", "manufacturing", "videos"] as const;
export type LibraryFolder = (typeof LIBRARY_FOLDERS)[number];

export function isLibraryFolder(value: unknown): value is LibraryFolder {
  return typeof value === "string" && (LIBRARY_FOLDERS as readonly string[]).includes(value);
}

export function kindForContentType(type: string): UploadKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(type)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(type)) return "video";
  return null;
}

/** Lower-case, safe filename (no paths, no special characters). */
export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "").toLowerCase();
  return (cleaned || "file").slice(0, 100);
}

/** Library object key: <folder>/<yyyy-mm>/<timestamp>-<name>. */
export function libraryObjectKey(folder: LibraryFolder, filename: string, now: Date): string {
  return `${folder}/${now.toISOString().slice(0, 7)}/${now.getTime()}-${cleanFilename(filename)}`;
}

/**
 * Checks the file's leading bytes match its declared type, so a renamed file
 * (e.g. a script called photo.jpg) is rejected.
 */
export function sniffMatchesType(bytes: Uint8Array, type: string): boolean {
  const at = (i: number) => bytes[i];
  const ascii = (start: number, text: string) => [...text].every((c, i) => at(start + i) === c.charCodeAt(0));
  switch (type) {
    case "image/jpeg":
      return at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
    case "image/png":
      return at(0) === 0x89 && ascii(1, "PNG");
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "video/mp4":
      return ascii(4, "ftyp");
    case "video/webm":
      return at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3;
    default:
      return false;
  }
}

export type UploadCheck = { ok: true; kind: UploadKind } | { ok: false; error: string; message: string; status: number };

export function checkUpload(file: { type: string; size: number }, head: Uint8Array): UploadCheck {
  const kind = kindForContentType(file.type);
  if (!kind) return { ok: false, error: "invalid_content_type", message: "Only JPEG, PNG, WebP images and MP4, WebM videos are allowed.", status: 400 };
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size <= 0) return { ok: false, error: "empty_file", message: "The file is empty.", status: 400 };
  if (file.size > max) {
    return { ok: false, error: "file_too_large", message: `The ${kind} is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${(max / 1048576).toFixed(0)} MB.`, status: 413 };
  }
  if (!sniffMatchesType(head, file.type)) {
    return { ok: false, error: "content_mismatch", message: "The file contents do not match its type.", status: 400 };
  }
  return { ok: true, kind };
}
