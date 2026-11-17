/**
 * Runtime mode: the single place that decides whether this process may talk
 * to PRODUCTION AWS resources.
 *
 *   "production": running on Vercel (VERCEL=1) in a production build.
 *                 The only mode allowed to use the real DynamoDB table, the
 *                 real S3 bucket and real AWS credentials.
 *   "local":      everything else (next dev, next build/start on a laptop,
 *                 tests, scripts). Production AWS is unreachable from this
 *                 mode by construction:
 *                   - DynamoDB only connects to a localhost DYNAMODB_ENDPOINT
 *                     with dummy credentials (never the env AWS keys);
 *                   - S3 is disabled; media uses LOCAL_MEDIA_DIR on disk;
 *                   - ASSET_CDN_URL is ignored;
 *                   - the mock admin identity provider is only accepted here.
 *
 * Safe-by-default: any doubt resolves to "local".
 */
export type RuntimeMode = "production" | "local";

type Env = Record<string, string | undefined>;

export function runtimeMode(env: Env = process.env): RuntimeMode {
  return env.VERCEL === "1" && env.NODE_ENV === "production" ? "production" : "local";
}

export function isProductionRuntime(env: Env = process.env): boolean {
  return runtimeMode(env) === "production";
}

export class LocalSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalSafetyError";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** True for http(s)://localhost / 127.0.0.1 / ::1 URLs only. */
export function isLocalUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Dummy credentials for local emulators: real AWS keys are never used locally. */
export const LOCAL_DUMMY_CREDENTIALS = Object.freeze({ accessKeyId: "local", secretAccessKey: "local" });
