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
 * Production AWS keys present in .env.local are therefore never used by the
 * app's DynamoDB client outside Vercel.
 */
import { isLocalUrl, LOCAL_DUMMY_CREDENTIALS, LocalSafetyError, runtimeMode } from "@/lib/runtime/mode";

type Env = Record<string, string | undefined>;

export type DbTarget =
  | { kind: "production" }
  | { kind: "local"; endpoint: string; credentials: { accessKeyId: string; secretAccessKey: string } }
  | { kind: "disabled"; reason: string };

export function resolveDbTarget(env: Env = process.env): DbTarget {
  if (runtimeMode(env) === "production") return { kind: "production" };

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
