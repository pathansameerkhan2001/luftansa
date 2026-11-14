/**
 * Admin session: the encrypted ID token (session cookie) and refresh token.
 * Used by middleware (with refresh) and server components (read-only check).
 */
import type { JWTPayload } from "jose";
import type { AuthConfig } from "./config";
import { adminEmailOf, AuthError, refreshTokens, verifyIdToken } from "./cognito";
import { seal, unseal } from "./crypto";

export interface AdminSession {
  email: string;
  /** ID token expiry (epoch seconds). */
  expiresAt: number;
}

interface SealedToken extends JWTPayload {
  t: string;
}

export function sealToken(config: AuthConfig, token: string, maxAge: number) {
  return seal({ t: token }, config.secret, maxAge);
}

/** Verifies the session cookie. Returns null if missing, invalid, expired or not an admin. */
export async function readSession(config: AuthConfig, sessionCookie: string | undefined): Promise<AdminSession | null> {
  const sealed = await unseal<SealedToken>(sessionCookie, config.secret);
  if (!sealed?.t) return null;
  try {
    const claims = await verifyIdToken(config, sealed.t);
    const email = adminEmailOf(config, claims);
    return email && claims.exp ? { email, expiresAt: claims.exp } : null;
  } catch {
    return null;
  }
}

export interface RefreshedSession {
  session: AdminSession;
  sealedSession: string;
  /** Present only when Cognito rotated the refresh token. */
  sealedRefresh?: string;
}

/** Uses the refresh-token cookie to obtain and verify a fresh ID token. */
export async function refreshSession(config: AuthConfig, refreshCookie: string | undefined): Promise<RefreshedSession | null> {
  const sealed = await unseal<SealedToken>(refreshCookie, config.secret);
  if (!sealed?.t) return null;
  try {
    const tokens = await refreshTokens(config, sealed.t);
    if (!tokens.id_token) return null;
    const claims = await verifyIdToken(config, tokens.id_token);
    const email = adminEmailOf(config, claims);
    if (!email || !claims.exp) return null;
    return {
      session: { email, expiresAt: claims.exp },
      sealedSession: await sealToken(config, tokens.id_token, config.sessionMaxAge),
      sealedRefresh: tokens.refresh_token ? await sealToken(config, tokens.refresh_token, config.sessionMaxAge) : undefined,
    };
  } catch (e) {
    if (!(e instanceof AuthError)) console.warn("[auth] unexpected refresh failure");
    return null;
  }
}
