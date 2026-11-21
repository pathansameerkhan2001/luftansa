/**
 * Preview isolation: which Vercel deployment this is, and whether a Preview
 * deployment is configured with its OWN AWS resources (pure, testable, no I/O).
 *
 * Vercel sets VERCEL_ENV on every deployment ("production", "preview",
 * "development"), next to VERCEL=1 which ./mode.ts already relies on.
 *
 *   "production": runtimeMode() is "production" and VERCEL_ENV is "production".
 *                 Behaviour is exactly what it was before this module existed.
 *   "preview":    runtimeMode() is "production" but VERCEL_ENV is anything else
 *                 (including missing). Treated as an isolated environment that
 *                 FAILS CLOSED: the database and media storage are only used
 *                 when every rule below is met, otherwise they are disabled.
 *   "local":      runtimeMode() is "local" (laptops, tests, scripts); see ./mode.ts.
 *
 * Preview rules (docs/preview-isolation.md):
 *   - DYNAMODB_TABLE and AWS_S3_BUCKET must be set explicitly (no fallback),
 *     must not be a production resource name, and must contain "preview";
 *   - AWS_ROLE_ARN must be set: AWS access only through the Preview OIDC role.
 *     Long-lived AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are never used, even
 *     when present (they may be the production keys).
 * Problems name variables only; values are never included.
 */
import { runtimeMode } from "./mode";

type Env = Record<string, string | undefined>;

export type DeploymentEnv = "production" | "preview" | "local";

/** Production AWS resources. A Preview deployment refuses these names. */
export const PRODUCTION_DYNAMODB_TABLES: readonly string[] = ["luftansa-store"];
export const PRODUCTION_S3_BUCKETS: readonly string[] = ["luftansa-store-assets"];

export function deploymentEnv(env: Env = process.env): DeploymentEnv {
  if (runtimeMode(env) !== "production") return "local";
  return env.VERCEL_ENV === "production" ? "production" : "preview";
}

export const isPreviewDeployment = (env: Env = process.env) => deploymentEnv(env) === "preview";

const isProductionName = (name: string, list: readonly string[]) => list.some((p) => p.toLowerCase() === name.toLowerCase());

function resourceProblems(variable: string, value: string | undefined, production: readonly string[]): string[] {
  const name = value?.trim();
  if (!name) return [`${variable} is not set (Preview never falls back to a default)`];
  if (isProductionName(name, production)) return [`${variable} names a production resource`];
  if (!/preview/i.test(name)) return [`${variable} must name a Preview resource (its name must contain "preview")`];
  return [];
}

function credentialProblems(env: Env): string[] {
  return env.AWS_ROLE_ARN?.trim() ? [] : ["AWS_ROLE_ARN is not set (Preview uses only its OIDC role, never access keys)"];
}

/** Why a Preview deployment may not use DynamoDB (empty: it may). Not meaningful outside Preview. */
export function previewDatabaseProblems(env: Env = process.env): string[] {
  return [...resourceProblems("DYNAMODB_TABLE", env.DYNAMODB_TABLE, PRODUCTION_DYNAMODB_TABLES), ...credentialProblems(env)];
}

/** Why a Preview deployment may not use S3 media storage (empty: it may). Not meaningful outside Preview. */
export function previewStorageProblems(env: Env = process.env): string[] {
  return [...resourceProblems("AWS_S3_BUCKET", env.AWS_S3_BUCKET, PRODUCTION_S3_BUCKETS), ...credentialProblems(env)];
}

/** Error raised when Preview code is about to use AWS without a valid isolated configuration. */
export class PreviewIsolationError extends Error {
  constructor(problems: readonly string[]) {
    super(`Preview isolation: ${problems.join("; ")}`);
    this.name = "PreviewIsolationError";
  }
}

const warned = new Set<string>();
/** Logs each isolation problem once per process (variable names only). */
export function warnPreviewIsolation(area: string, problems: readonly string[]): void {
  const key = `${area}:${problems.join("|")}`;
  if (problems.length === 0 || warned.has(key)) return;
  warned.add(key);
  console.error(`[preview-isolation] ${area} disabled: ${problems.join("; ")}`);
}
