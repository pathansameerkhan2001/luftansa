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
 */
async function handle(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  let key: string;
  try {
    key = segments.map(decodeURIComponent).join("/");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  return serveMedia(request, key, getMediaStorage());
}

export const GET = handle;
export const HEAD = handle;
