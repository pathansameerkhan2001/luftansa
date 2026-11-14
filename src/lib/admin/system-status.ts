import "server-only";

import { awsCredentialMode } from "@/lib/aws/credentials";
import { getDbConfig } from "@/lib/db/config";

/**
 * Configuration status for the admin dashboard. Reads environment presence
 * only: no AWS calls, and never returns secret values.
 */
export interface SystemStatus {
  database: { configured: boolean; table?: string; region?: string };
  storage: { configured: boolean; bucket?: string; cdn: boolean };
  credentials: { mode: "vercel-oidc" | "default-chain"; usesLongLivedKeys: boolean };
}

export function getSystemStatus(): SystemStatus {
  const db = getDbConfig();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const mode = awsCredentialMode();
  return {
    database: db ? { configured: true, table: db.tableName, region: db.region } : { configured: false },
    storage: { configured: Boolean(bucket && process.env.AWS_REGION?.trim()), bucket: bucket || undefined, cdn: Boolean(process.env.ASSET_CDN_URL?.trim()) },
    credentials: { mode, usesLongLivedKeys: mode === "default-chain" && Boolean(process.env.AWS_ACCESS_KEY_ID?.trim()) },
  };
}
