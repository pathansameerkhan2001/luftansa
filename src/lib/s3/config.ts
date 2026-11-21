import "server-only";

import { deploymentEnv, PreviewIsolationError, previewStorageProblems } from "@/lib/runtime/preview-isolation";

/**
 * Server-only S3 configuration.
 *
 * Values come exclusively from server environment variables (never NEXT_PUBLIC_*),
 * so they are never inlined into browser bundles. The "server-only" import makes
 * the build fail if this module is ever imported from a Client Component.
 *
 * Vercel Preview: only an explicit Preview bucket, and only through the Preview
 * OIDC role. Long-lived access keys in the environment are ignored there, and a
 * missing or production bucket is refused (src/lib/runtime/preview-isolation.ts).
 */
type Env = Record<string, string | undefined>;

/** Where S3 credentials come from. Production behaviour is unchanged: keys when set, else the default chain. */
export type S3CredentialSource =
  | { kind: "static"; accessKeyId: string; secretAccessKey: string }
  | { kind: "default-chain" }
  | { kind: "oidc-role"; roleArn: string };

export interface S3Config {
  region: string;
  bucket: string;
  credentials: S3CredentialSource;
}

/** Pure resolution (testable). Throws when S3 is not configured, or when a Preview is not isolated. */
export function resolveS3Config(env: Env = process.env): S3Config {
  const preview = deploymentEnv(env) === "preview";
  if (preview) {
    const problems = previewStorageProblems(env);
    if (problems.length > 0) throw new PreviewIsolationError(problems);
  }
  const region = env.AWS_REGION?.trim();
  const bucket = env.AWS_S3_BUCKET?.trim();
  if (!region || !bucket) {
    throw new Error("S3 is not configured: set AWS_REGION and AWS_S3_BUCKET in .env.local (see .env.example).");
  }
  if (preview) return { region, bucket, credentials: { kind: "oidc-role", roleArn: env.AWS_ROLE_ARN!.trim() } };

  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  return {
    region,
    bucket,
    credentials: accessKeyId && secretAccessKey ? { kind: "static", accessKeyId, secretAccessKey } : { kind: "default-chain" },
  };
}

let cached: S3Config | null = null;

export function getS3Config(): S3Config {
  if (!cached) cached = resolveS3Config();
  return cached;
}
