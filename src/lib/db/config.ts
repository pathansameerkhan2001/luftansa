/**
 * DynamoDB configuration (server environment only).
 *   DYNAMODB_TABLE   e.g. "luftansa-store"
 *   DYNAMODB_REGION  e.g. "ap-south-2" (falls back to AWS_REGION)
 * Returns null when not configured, so callers can show a setup state.
 */
export interface DbConfig {
  tableName: string;
  region: string;
}

export function getDbConfig(): DbConfig | null {
  const tableName = process.env.DYNAMODB_TABLE?.trim();
  const region = (process.env.DYNAMODB_REGION ?? process.env.AWS_REGION)?.trim();
  if (!tableName || !region) return null;
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(tableName)) return null;
  return { tableName, region };
}
