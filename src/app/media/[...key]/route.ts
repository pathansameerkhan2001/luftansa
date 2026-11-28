import { parseVariantRequest } from "@/lib/media/image-variants";
import { serveMediaVariant } from "@/lib/media/resize";
import { serveMedia } from "@/lib/media/serve";
import { getMediaStorage } from "@/lib/media/storage";

export const runtime = "nodejs";

/**
 * GET|HEAD /media/<key>
 *
 * Streams an allow-listed object from the private S3 bucket (production) or
 * the local media folder (local development), with HTTP Range support so
 * Safari can play videos. Credentials never leave the server and the bucket is
 * never made public.
 *
 * GET|HEAD /media/<key>?w=<width>&q=<quality>
 *
 * A resized WebP copy of an image, for next/image (src/lib/image-loader.ts),
 * so the site does not depend on Vercel's metered Image Optimization.
 */
async function handle(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  let key: string;
  try {
    key = segments.map(decodeURIComponent).join("/");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const variant = parseVariantRequest(new URL(request.url).searchParams);
  if (variant.kind === "invalid") return new Response("Unsupported image size", { status: 400, headers: { "Cache-Control": "no-store" } });
  if (variant.kind === "variant") return serveMediaVariant(request, key, getMediaStorage(), variant);
  return serveMedia(request, key, getMediaStorage());
}

export const GET = handle;
export const HEAD = handle;
