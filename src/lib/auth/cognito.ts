/**
 * Cognito OAuth 2.0 / OIDC operations for a PUBLIC app client (no secret):
 * code exchange with PKCE, refresh, revocation and ID-token verification.
 *
 * Tokens are never logged; failures surface as AuthError codes only.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthConfig } from "./config";

export class AuthError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

interface TokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface IdTokenClaims extends JWTPayload {
  email?: string;
  email_verified?: boolean | string;
  token_use?: string;
  nonce?: string;
  "cognito:username"?: string;
}

async function tokenRequest(config: AuthConfig, body: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(`${config.domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: config.clientId, ...body }),
      cache: "no-store",
    });
  } catch {
    throw new AuthError("token_endpoint_unreachable");
  }
  if (!res.ok) {
    // Only the OAuth error code is logged, never the request or response body.
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    console.warn(`[auth] token endpoint ${res.status} ${err.error ?? "unknown_error"}`);
    throw new AuthError(err.error === "invalid_grant" ? "invalid_grant" : "token_exchange_failed");
  }
  return (await res.json()) as TokenResponse;
}

/** Authorization Code + PKCE exchange (no client secret). */
export function exchangeCode(config: AuthConfig, code: string, codeVerifier: string) {
  return tokenRequest(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
}

export function refreshTokens(config: AuthConfig, refreshToken: string) {
  return tokenRequest(config, { grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Best-effort refresh-token revocation on logout. */
export async function revokeRefreshToken(config: AuthConfig, refreshToken: string): Promise<void> {
  try {
    await fetch(`${config.domain}/oauth2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, token: refreshToken }),
      cache: "no-store",
    });
  } catch {
    console.warn("[auth] refresh token revocation failed (network)");
  }
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwks(config: AuthConfig) {
  let set = jwksCache.get(config.jwksUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(config.jwksUrl));
    jwksCache.set(config.jwksUrl, set);
  }
  return set;
}

/**
 * Verifies an ID token: RS256 signature against the pool JWKS, issuer,
 * audience (client id), expiry, token_use=id and, when given, the nonce.
 */
export async function verifyIdToken(config: AuthConfig, idToken: string, expectedNonce?: string): Promise<IdTokenClaims> {
  let payload: IdTokenClaims;
  try {
    ({ payload } = await jwtVerify<IdTokenClaims>(idToken, jwks(config), {
      issuer: config.issuer,
      audience: config.clientId,
      algorithms: ["RS256"],
      clockTolerance: 5,
    }));
  } catch (e) {
    throw new AuthError((e as { code?: string }).code === "ERR_JWT_EXPIRED" ? "token_expired" : "invalid_token");
  }
  if (payload.token_use !== "id") throw new AuthError("invalid_token");
  if (expectedNonce !== undefined && payload.nonce !== expectedNonce) throw new AuthError("invalid_nonce");
  return payload;
}

/** Administrator check: verified email that is on the ADMIN_EMAILS allow-list. */
export function adminEmailOf(config: AuthConfig, claims: IdTokenClaims): string | null {
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  const verified = claims.email_verified === true || claims.email_verified === "true";
  return email && verified && config.adminEmails.includes(email) ? email : null;
}

/** Cognito Managed Login logout URL (clears the Cognito session, then returns to the site). */
export function cognitoLogoutUrl(config: AuthConfig): string {
  const url = new URL(`${config.domain}/logout`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("logout_uri", config.logoutRedirectUri);
  return url.toString();
}
