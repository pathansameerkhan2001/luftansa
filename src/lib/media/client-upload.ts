/**
 * Browser-side Media Library upload (shared by the Media Library page and the
 * CMS Media Picker, so both upload exactly the same way).
 *
 * Images are compressed in the browser to the server's limit; videos must
 * already be within it (4 MB in production until direct uploads are approved).
 * The server re-checks type, size and the file's actual bytes.
 */
import { compressImageForUpload } from "./compress-image";

export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const VIDEO_ACCEPT = "video/mp4,video/webm";
export const MAX_SOURCE_IMAGE_BYTES = 40 * 1024 * 1024;

export interface UploadLimits {
  imageBytes: number;
  videoBytes: number;
}

export interface UploadedMedia {
  key: string;
  publicUrl: string;
  kind: "image" | "video";
  sizeBytes: number;
  mediaId?: string;
}

export const formatBytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Width/height (and duration for videos), measured in the browser. Best effort. */
export async function measureMedia(file: File): Promise<{ width?: number; height?: number; durationSeconds?: number }> {
  try {
    if (file.type.startsWith("image/")) {
      const bmp = await createImageBitmap(file);
      const out = { width: bmp.width, height: bmp.height };
      bmp.close();
      return out;
    }
    const url = URL.createObjectURL(file);
    try {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(new Error("metadata"));
      });
      return { width: v.videoWidth || undefined, height: v.videoHeight || undefined, durationSeconds: Number.isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : undefined };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return {};
  }
}

/**
 * Uploads one file to the Media Library folder. Throws an Error with a
 * readable message on any failure. `post` performs the request (adminFetch).
 */
export async function uploadToMediaLibrary(
  file: File,
  folder: string,
  limits: UploadLimits,
  post: (form: FormData) => Promise<UploadedMedia>,
  accept: string = UPLOAD_ACCEPT,
): Promise<UploadedMedia> {
  if (!accept.split(",").includes(file.type)) {
    throw new Error(accept === IMAGE_ACCEPT ? "Only JPEG, PNG or WebP images." : accept === VIDEO_ACCEPT ? "Only MP4 or WebM videos." : "Only JPEG, PNG, WebP, MP4 or WebM files.");
  }
  let prepared: File = file;
  if (file.type.startsWith("image/")) {
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("Please choose an image under 40 MB.");
    prepared = await compressImageForUpload(file, limits.imageBytes);
  } else if (file.size > limits.videoBytes) {
    throw new Error(`Videos are limited to ${formatBytes(limits.videoBytes)} until direct uploads are approved. This file is ${formatBytes(file.size)}.`);
  }
  const dims = await measureMedia(prepared);
  const form = new FormData();
  form.append("file", prepared, prepared.name || file.name);
  form.append("target", "library");
  form.append("folder", folder);
  if (dims.width) form.append("width", String(dims.width));
  if (dims.height) form.append("height", String(dims.height));
  if (dims.durationSeconds) form.append("durationSeconds", String(dims.durationSeconds));
  return post(form);
}
