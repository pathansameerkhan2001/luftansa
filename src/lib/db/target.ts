/**
 * Which DynamoDB this process connects to (pure, testable).
 *
 * - production runtime (Vercel): the real table, with the real credential
 *   chain. DYNAMODB_ENDPOINT is ignored there.
 * - local runtime: ONLY a localhost DynamoDB (DynamoDB Local) set through
 *   DYNAMODB_ENDPOINT, with dummy credentials. Without it the database is
 *   "disabled": the storefront serves its built-in fallback catalogue and the
 *   admin reports "database not configured". A non-local endpoint is refused.
 *
 * - Vercel Preview: the Preview table only, through the Preview OIDC role
 *   (never access keys). Without a valid isolated configuration it is
 *   "disabled" (src/lib/runtime/preview-isolation.ts).
 *
 * Production AWS keys present in .env.local are therefore never used by the
 * app's DynamoDB client outside Vercel.
 */
import { isLocalUrl, LOCAL_DUMMY_CREDENTIALS, LocalSafetyError } from "@/lib/runtime/mode";
import { deploymentEnv, previewDatabaseProblems } from "@/lib/runtime/preview-isolation";

type Env = Record<string, string | undefined>;

export type DbTarget =
  | { kind: "production" }
  | { kind: "preview"; roleArn: string }
  | { kind: "local"; endpoint: string; credentials: { accessKeyId: string; secretAccessKey: string } }
  | { kind: "disabled"; reason: string };

export function resolveDbTarget(env: Env = process.env): DbTarget {
  const deployment = deploymentEnv(env);
  if (deployment === "production") return { kind: "production" };
  if (deployment === "preview") {
    const problems = previewDatabaseProblems(env);
    if (problems.length > 0) return { kind: "disabled", reason: `Preview isolation: ${problems.join("; ")}` };
    return { kind: "preview", roleArn: env.AWS_ROLE_ARN!.trim() };
  }

  const endpoint = env.DYNAMODB_ENDPOINT?.trim();
  if (!endpoint) {
    return { kind: "disabled", reason: "Local mode: set DYNAMODB_ENDPOINT to a DynamoDB Local URL (npm run local:db)." };
  }
  if (!isLocalUrl(endpoint)) {
    throw new LocalSafetyError("Refusing DYNAMODB_ENDPOINT that is not localhost: production DynamoDB is never used locally.");
  }
  // A fresh object: the AWS SDK annotates the credentials it receives, so the frozen constant cannot be passed directly.
  return { kind: "local", endpoint, credentials: { ...LOCAL_DUMMY_CREDENTIALS } };
}

/** Local table name (never the production table name unless explicitly configured). */
export const LOCAL_DEFAULT_TABLE = "luftansa-local";
