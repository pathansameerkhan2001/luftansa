import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "./client";
import { getS3Config } from "./config";

export { getS3Client } from "./client";
export { getS3Config } from "./config";

/**
 * Top-level folders in the bucket that the site is allowed to serve.
 * Anything outside these prefixes is never exposed, even through the media route.
 */
export const S3_ASSET_FOLDERS = [
  "logo/",
  "hero/",
  "products/",
  "categories/",
  "banners/",
  "about/",
  "general/",
  "reels/thumbnails/",
  "reels/videos/",
] as const;

export type S3AssetFolder = (typeof S3_ASSET_FOLDERS)[number];

/**
 * Validates an object key: must sit inside an allowlisted folder and must not
 * contain traversal segments, backslashes, or point at a "folder" placeholder.
 */
export function isAllowedAssetKey(key: string): boolean {
  if (!key || key.length > 512 || key.endsWith("/") || key.includes("\\")) return false;
  if (key.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return false;
  return S3_ASSET_FOLDERS.some((folder) => key.startsWith(folder));
}

/**
 * Short-lived presigned GET URL for a private object. Useful for large media
 * (e.g. reels/videos/) that should be fetched directly from S3 with Range
 * support. The bucket stays private; the URL expires.
 */
export async function getSignedAssetUrl(key: string, expiresInSeconds = 900): Promise<string> {
  if (!isAllowedAssetKey(key)) throw new Error(`Asset key not allowed: ${key}`);
  const { bucket } = getS3Config();
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}
