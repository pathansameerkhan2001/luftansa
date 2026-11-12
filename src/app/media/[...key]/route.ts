import { GetObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { getS3Client, getS3Config, isAllowedAssetKey } from "@/lib/s3";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/**
 * GET /media/<key>
 *
 * Streams an allowlisted object from the private S3 bucket using server-side
 * credentials. Credentials never leave the server; the bucket is never made
 * public. Replace with CloudFront (set ASSET_CDN_URL) for production scale.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.map(decodeURIComponent).join("/");

  if (!isAllowedAssetKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { bucket } = getS3Config();
    const object = await getS3Client().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        IfNoneMatch: request.headers.get("if-none-match") ?? undefined,
      }),
    );

    if (!object.Body) return new Response("Not found", { status: 404 });

    const headers = new Headers({
      "Content-Type": object.ContentType ?? "application/octet-stream",
      "Cache-Control": CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    });
    if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));
    if (object.ETag) headers.set("ETag", object.ETag);
    if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());

    return new Response(object.Body.transformToWebStream(), { status: 200, headers });
  } catch (error) {
    const status = error instanceof S3ServiceException ? error.$metadata.httpStatusCode : undefined;
    if (status === 304) {
      return new Response(null, { status: 304, headers: { "Cache-Control": CACHE_CONTROL } });
    }
    if (status === 404 || status === 403) {
      return new Response("Not found", { status: 404 });
    }
    console.error("[media] Failed to load asset from S3:", key, (error as Error).name);
    return new Response("Asset unavailable", { status: 502 });
  }
}
