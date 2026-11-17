import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { LocalSafetyError, runtimeMode } from "@/lib/runtime/mode";
import { getS3Config } from "./config";

let client: S3Client | null = null;

/**
 * Lazily-created, process-wide S3 client (server only).
 *
 * Only available in the production runtime (Vercel). Locally it throws, so no
 * code path can read from or write to the production bucket with the AWS keys
 * in .env.local: local media is served from LOCAL_MEDIA_DIR instead
 * (src/lib/media/storage.ts).
 */
export function getS3Client(): S3Client {
  if (runtimeMode() !== "production") {
    throw new LocalSafetyError("S3 is disabled outside Vercel production; local media uses LOCAL_MEDIA_DIR.");
  }
  if (client) return client;
  const { region, credentials } = getS3Config();
  client = new S3Client({ region, credentials });
  return client;
}
