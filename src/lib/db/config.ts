/**
 * DynamoDB configuration (server environment only).
 *   DYNAMODB_TABLE   e.g. "luftansa-store" (production) / "luftansa-local" (local default)
 *   DYNAMODB_REGION  e.g. "ap-south-2" (falls back to AWS_REGION)
 * Returns null when not configured, so callers can show a setup state.
 * Which endpoint/credentials are used is decided by ./target.ts.
 *
 * Vercel Preview deployments never fall back to a table name: they need an
 * explicit Preview table, otherwise the database is not configured
 * (src/lib/runtime/preview-isolation.ts).
 */
import { previewDatabaseProblems, deploymentEnv, warnPreviewIsolation } from "@/lib/runtime/preview-isolation";
import { LOCAL_DEFAULT_TABLE } from "./target";

type Env = Record<string, string | undefined>;

export interface DbConfig {
  tableName: string;
  region: string;
}

export function getDbConfig(env: Env = process.env): DbConfig | null {
  const deployment = deploymentEnv(env);
  if (deployment === "preview") {
    const problems = previewDatabaseProblems(env);
    if (problems.length > 0) {
      warnPreviewIsolation("database", problems);
      return null;
    }
  }
  // Production keeps its historical default table; Preview has no fallback (checked above).
  const fallbackTable = deployment === "production" ? "luftansa-store" : deployment === "local" ? LOCAL_DEFAULT_TABLE : undefined;
  const tableName = (env.DYNAMODB_TABLE ?? fallbackTable)?.trim();
  const region = (env.DYNAMODB_REGION ?? env.AWS_REGION ?? "ap-south-2")?.trim();
  if (!tableName || !region) return null;
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(tableName)) return null;
  return { tableName, region };
}
