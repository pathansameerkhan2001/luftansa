import "server-only";

import { awsCredentialMode } from "@/lib/aws/credentials";
import { getDbConfig } from "@/lib/db/config";
import { deploymentEnv, previewDatabaseProblems, previewStorageProblems, type DeploymentEnv } from "@/lib/runtime/preview-isolation";

/**
 * Configuration status for the admin dashboard. Reads environment presence
 * only: no AWS calls, and never returns secret values.
 */
export interface SystemStatus {
  /** production / preview (Vercel Preview, isolated) / local. */
  deployment: DeploymentEnv;
  /** Preview only: why the database or media storage is disabled (variable names only). */
  isolationProblems: string[];
  database: { configured: boolean; table?: string; region?: string };
  storage: { configured: boolean; bucket?: string; cdn: boolean };
  credentials: { mode: "vercel-oidc" | "default-chain"; usesLongLivedKeys: boolean };
}

export function getSystemStatus(): SystemStatus {
  const deployment = deploymentEnv();
  const isolationProblems = deployment === "preview" ? [...new Set([...previewDatabaseProblems(), ...previewStorageProblems()])] : [];
  const db = getDbConfig();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const mode = awsCredentialMode();
  const storageIsolated = deployment !== "preview" || previewStorageProblems().length === 0;
  return {
    deployment,
    isolationProblems,
    database: db ? { configured: true, table: db.tableName, region: db.region } : { configured: false },
    storage: {
      configured: Boolean(bucket && process.env.AWS_REGION?.trim()) && storageIsolated,
      bucket: bucket || undefined,
      cdn: deployment === "production" && Boolean(process.env.ASSET_CDN_URL?.trim()),
    },
    credentials: {
      mode,
      // A Preview never uses long-lived keys, even when they are present.
      usesLongLivedKeys: deployment !== "preview" && mode === "default-chain" && Boolean(process.env.AWS_ACCESS_KEY_ID?.trim()),
    },
  };
}
