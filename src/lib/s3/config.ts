import "server-only";

/**
 * Server-only S3 configuration.
 *
 * Values come exclusively from server environment variables (never NEXT_PUBLIC_*),
 * so they are never inlined into browser bundles. The "server-only" import makes
 * the build fail if this module is ever imported from a Client Component.
 */
export interface S3Config {
  region: string;
  bucket: string;
  /** Explicit credentials, if provided via env. Otherwise the AWS SDK default
   * credential chain is used (shared ~/.aws profile locally, IAM role in prod). */
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

let cached: S3Config | null = null;

export function getS3Config(): S3Config {
  if (cached) return cached;

  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucket) {
    throw new Error(
      "S3 is not configured: set AWS_REGION and AWS_S3_BUCKET in .env.local (see .env.example).",
    );
  }

  cached = {
    region,
    bucket,
    credentials:
      accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
  return cached;
}
