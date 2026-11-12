import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { getS3Config } from "./config";

let client: S3Client | null = null;

/** Lazily-created, process-wide S3 client (server only). */
export function getS3Client(): S3Client {
  if (client) return client;
  const { region, credentials } = getS3Config();
  client = new S3Client({ region, credentials });
  return client;
}
