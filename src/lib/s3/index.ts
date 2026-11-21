import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "./client";
import { getS3Config } from "./config";

export { getS3Client } from "./client";
export { getS3Config } from "./config";
export { isAllowedAssetKey, S3_ASSET_FOLDERS, type S3AssetFolder } from "./asset-keys";
import { isAllowedAssetKey } from "./asset-keys";

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

/**
 * Short-lived presigned PUT URL for uploading an object directly to private S3.
 * Validates key prefix against allowlisted asset folders and sets content-type.
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 600,
): Promise<string> {
  if (!isAllowedAssetKey(key)) throw new Error(`Asset key not allowed: ${key}`);
  const { bucket } = getS3Config();
  return getSignedUrl(
    getS3Client(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds },
  );
}
