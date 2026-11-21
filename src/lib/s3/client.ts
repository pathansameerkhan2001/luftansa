import "server-only";

import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { oidcRoleCredentials } from "@/lib/aws/credentials";
import { LocalSafetyError, runtimeMode } from "@/lib/runtime/mode";
import { getS3Config, type S3CredentialSource } from "./config";

let client: S3Client | null = null;

/** SDK credentials for a credential source. "default-chain" is never produced for a Preview (see ./config.ts). */
export function s3ClientCredentials(source: S3CredentialSource): S3ClientConfig["credentials"] {
  switch (source.kind) {
    case "static":
      return { accessKeyId: source.accessKeyId, secretAccessKey: source.secretAccessKey };
    case "oidc-role":
      return oidcRoleCredentials(source.roleArn);
    case "default-chain":
      return undefined;
  }
}

/**
 * Lazily-created, process-wide S3 client (server only).
 *
 * Only available in the production runtime (Vercel). Locally it throws, so no
 * code path can read from or write to the production bucket with the AWS keys
 * in .env.local: local media is served from LOCAL_MEDIA_DIR instead
 * (src/lib/media/storage.ts). On a Vercel Preview it only exists with an
 * isolated Preview bucket and role (otherwise getS3Config throws).
 */
export function getS3Client(): S3Client {
  if (runtimeMode() !== "production") {
    throw new LocalSafetyError("S3 is disabled outside Vercel production; local media uses LOCAL_MEDIA_DIR.");
  }
  if (client) return client;
  const { region, credentials } = getS3Config();
  client = new S3Client({ region, credentials: s3ClientCredentials(credentials) });
  return client;
}
