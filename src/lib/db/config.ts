/**
 * DynamoDB configuration (server environment only).
 *   DYNAMODB_TABLE   e.g. "luftansa-store" (production) / "luftansa-local" (local default)
 *   DYNAMODB_REGION  e.g. "ap-south-2" (falls back to AWS_REGION)
 * Returns null when not configured, so callers can show a setup state.
 * Which endpoint/credentials are used is decided by ./target.ts.
 */
import { runtimeMode } from "@/lib/runtime/mode";
import { LOCAL_DEFAULT_TABLE } from "./target";

export interface DbConfig {
  tableName: string;
  region: string;
}

export function getDbConfig(): DbConfig | null {
  const fallbackTable = runtimeMode() === "production" ? "luftansa-store" : LOCAL_DEFAULT_TABLE;
  const tableName = (process.env.DYNAMODB_TABLE ?? fallbackTable)?.trim();
  const region = (process.env.DYNAMODB_REGION ?? process.env.AWS_REGION ?? "ap-south-2")?.trim();
  if (!tableName || !region) return null;
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(tableName)) return null;
  return { tableName, region };
}
