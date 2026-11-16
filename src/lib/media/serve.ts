import "server-only";

import { isAllowedAssetKey } from "@/lib/s3";
import { contentRangeHeader, parseRange } from "./range";
import type { MediaStorage, StoredObjectInfo } from "./storage";

export const MEDIA_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * Largest byte range served per request. Ranges are returned as a buffered
 * slice with an exact Content-Length (Safari is strict about 206 responses,
 * and buffered serverless responses must stay well below ~4.5 MB). Longer
 * requested ranges are shortened, which RFC 9110 allows: Content-Range states
 * what was sent and the player requests the next slice.
 */
export const MAX_RANGE_BYTES = 2 * 1024 * 1024;

async function readAll(stream: ReadableStream<Uint8Array>, expected: number): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Uint8Array(new ArrayBuffer(expected));
  let offset = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value.subarray(0, Math.max(0, expected - offset)), offset);
    offset += value.length;
    if (offset >= expected) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  if (offset < expected) throw new Error("Short read");
  return out;
}

function baseHeaders(info: StoredObjectInfo): Headers {
  const h = new Headers({
    "Content-Type": info.contentType,
    "Cache-Control": MEDIA_CACHE_CONTROL,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  if (info.etag) h.set("ETag", info.etag);
  if (info.lastModified) h.set("Last-Modified", info.lastModified.toUTCString());
  return h;
}

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Serves an allow-listed media object with HTTP Range support (206/416),
 * conditional requests (304) and HEAD. Used by /media/[...key].
 */
export async function serveMedia(
  request: Request,
  key: string,
  storage: MediaStorage | null,
  options: { maxRangeBytes?: number } = {},
): Promise<Response> {
  const maxRange = Math.max(1, options.maxRangeBytes ?? MAX_RANGE_BYTES);
  if (!isAllowedAssetKey(key) || !storage) return notFound();
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  try {
    // Plain GET (no Range / conditional headers): one storage call, as before.
    if (method === "GET" && !request.headers.get("range") && !request.headers.get("if-none-match")) {
      const obj = await storage.read(key);
      if (!obj) return notFound();
      const h = baseHeaders(obj);
      h.set("Content-Length", String(obj.size));
      return new Response(obj.body, { status: 200, headers: h });
    }

    const info = await storage.head(key);
    if (!info) return notFound();

    const ifNoneMatch = request.headers.get("if-none-match");
    const rangeHeader = request.headers.get("range");
    // If-Range: only honour the range while the representation is unchanged.
    const ifRange = request.headers.get("if-range");
    const rangeAllowed = !ifRange || (info.etag !== undefined && ifRange === info.etag);
    const parsed = rangeAllowed ? parseRange(rangeHeader, info.size) : ({ kind: "none" } as const);

    if (parsed.kind === "unsatisfiable") {
      const h = baseHeaders(info);
      h.set("Content-Range", `bytes */${info.size}`);
      h.set("Cache-Control", "no-store");
      return new Response(null, { status: 416, headers: h });
    }

    if (parsed.kind === "none" && ifNoneMatch && info.etag && ifNoneMatch === info.etag) {
      return new Response(null, { status: 304, headers: baseHeaders(info) });
    }

    if (parsed.kind === "range") {
      const range = { start: parsed.range.start, end: Math.min(parsed.range.end, parsed.range.start + maxRange - 1) };
      const length = range.end - range.start + 1;
      const h = baseHeaders(info);
      h.set("Content-Range", contentRangeHeader(range, info.size));
      h.set("Content-Length", String(length));
      if (method === "HEAD") return new Response(null, { status: 206, headers: h });
      const obj = await storage.read(key, range);
      if (!obj) return notFound();
      const bytes = await readAll(obj.body, length);
      return new Response(bytes, { status: 206, headers: h });
    }

    const h = baseHeaders(info);
    h.set("Content-Length", String(info.size));
    if (method === "HEAD") return new Response(null, { status: 200, headers: h });
    const obj = await storage.read(key);
    if (!obj) return notFound();
    return new Response(obj.body, { status: 200, headers: h });
  } catch (error) {
    console.error("[media] Failed to load asset:", key, (error as Error).name);
    return new Response("Asset unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
