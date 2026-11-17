/**
 * Local development environment (Phase 3A, decisions D1 and D2).
 *
 * These values are passed as real process environment variables to Next.js,
 * which take priority over .env.local. Together with the runtime guard
 * (src/lib/runtime/mode.ts) they make the local app talk ONLY to:
 *   - DynamoDB Local on 127.0.0.1:8000 (table "luftansa-local", dummy credentials);
 *   - the local media folder .local/media;
 *   - the local mock identity provider on localhost:4010.
 * No production endpoint, bucket, table or credential is referenced here.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LOCAL_DIR = path.join(ROOT, ".local");
export const APP_PORT = Number(process.env.LOCAL_APP_PORT ?? 3000);
export const IDP_PORT = 4010;
export const DB_PORT = 8000;
export const LOCAL_ADMIN_EMAIL = "admin@luftansa.local";
export const LOCAL_CLIENT_ID = "luftansa-local-admin";

/** A random per-machine session secret (git-ignored), never a production secret. */
function localAuthSecret() {
  mkdirSync(LOCAL_DIR, { recursive: true });
  const file = path.join(LOCAL_DIR, "auth-secret");
  if (!existsSync(file)) writeFileSync(file, randomBytes(48).toString("base64url"), { mode: 0o600 });
  return readFileSync(file, "utf8").trim();
}

export function localEnv() {
  const app = `http://localhost:${APP_PORT}`;
  const idp = `http://localhost:${IDP_PORT}`;
  return {
    // Data: DynamoDB Local only.
    DYNAMODB_ENDPOINT: `http://127.0.0.1:${DB_PORT}`,
    DYNAMODB_TABLE: "luftansa-local",
    DYNAMODB_REGION: "ap-south-2",
    // Media: local folder only (S3 is disabled outside Vercel production).
    LOCAL_MEDIA_DIR: path.join(LOCAL_DIR, "media"),
    ASSET_CDN_URL: "",
    // Admin sign-in: local mock identity provider (rejected in production by src/lib/auth/config.ts).
    COGNITO_REGION: "ap-south-2",
    COGNITO_USER_POOL_ID: "local_mock_pool",
    COGNITO_CLIENT_ID: LOCAL_CLIENT_ID,
    COGNITO_DOMAIN: idp,
    COGNITO_ISSUER: idp,
    AUTH_REDIRECT_URI: `${app}/api/auth/callback`,
    AUTH_LOGOUT_REDIRECT_URI: `${app}/admin/login`,
    AUTH_SECRET: localAuthSecret(),
    ADMIN_EMAILS: LOCAL_ADMIN_EMAIL,
    // Never act as Vercel locally.
    VERCEL: "",
  };
}
