import "server-only";

import sharp from "sharp";
import { isAllowedAssetKey } from "@/lib/s3";
import { RESIZABLE_IMAGE } from "./image-variants";
import { MEDIA_CACHE_CONTROL, serveMedia } from "./serve";
import type { MediaStorage } from "./storage";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Resizes image bytes to at most `width` pixels wide (never enlarged), as WebP. Exported for tests. */
export async function resizeToWebp(input: Uint8Array, width: number, quality: number): Promise<Uint8Array<ArrayBuffer>> {
  const out = await sharp(input, { failOn: "error" })
    .rotate() // respect the camera orientation before EXIF is dropped
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  return new Uint8Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer);
}

/**
 * GET|HEAD /media/<key>?w=<width>&q=<quality>: a resized WebP copy of a stored
 * image (the stored file itself is never changed). Videos and other files,
 * and any image the resizer cannot read, are served exactly as stored, so a
 * picture is never lost because of resizing.
 */
export async function serveMediaVariant(
  request: Request,
  key: string,
  storage: MediaStorage | null,
  variant: { width: number; quality: number },
): Promise<Response> {
  if (!isAllowedAssetKey(key) || !storage) return notFound();
  const method = request.method.toUpperCase();
  if ((method !== "GET" && method !== "HEAD") || !RESIZABLE_IMAGE.test(key)) return serveMedia(request, key, storage);

  try {
    const obj = await storage.read(key);
    if (!obj) return notFound();
    const etag = obj.etag ? `"${obj.etag.replace(/"/g, "")}-w${variant.width}q${variant.quality}"` : undefined;
    const headers = new Headers({ "Content-Type": "image/webp", "Cache-Control": MEDIA_CACHE_CONTROL, "X-Content-Type-Options": "nosniff" });
    if (etag) headers.set("ETag", etag);
    if (obj.lastModified) headers.set("Last-Modified", obj.lastModified.toUTCString());
    if (etag && request.headers.get("if-none-match") === etag) {
      await obj.body.cancel().catch(() => {});
      return new Response(null, { status: 304, headers });
    }

    const original = new Uint8Array(await new Response(obj.body).arrayBuffer());
    let resized: Uint8Array<ArrayBuffer>;
    try {
      resized = await resizeToWebp(original, variant.width, variant.quality);
    } catch (error) {
      console.error("[media] Could not resize; serving the stored file:", key, (error as Error).message);
      const h = new Headers({ "Content-Type": obj.contentType, "Cache-Control": MEDIA_CACHE_CONTROL, "X-Content-Type-Options": "nosniff" });
      h.set("Content-Length", String(original.byteLength));
      return new Response(method === "HEAD" ? null : original, { status: 200, headers: h });
    }
    headers.set("Content-Length", String(resized.byteLength));
    return new Response(method === "HEAD" ? null : resized, { status: 200, headers });
  } catch (error) {
    console.error("[media] Failed to load asset:", key, (error as Error).name);
    return new Response("Asset unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
