import { parseAdminEmails } from "./admin-emails";

/**
 * Cognito authentication configuration, read exclusively from server
 * environment variables (never NEXT_PUBLIC_*). Shared by route handlers,
 * server components and middleware; never imported by client components.
 *
 * The app client is a PUBLIC client (no client secret): the Authorization
 * Code flow is protected with PKCE (S256), state and nonce instead.
 */

export interface AuthConfig {
  clientId: string;
  /** Managed Login / OAuth domain, e.g. https://<prefix>.auth.<region>.amazoncognito.com */
  domain: string;
  /** Token issuer, e.g. https://cognito-idp.<region>.amazonaws.com/<userPoolId> */
  issuer: string;
  jwksUrl: string;
  redirectUri: string;
  logoutRedirectUri: string;
  scopes: string;
  /** Lower-cased administrator emails allowed into /admin. */
  adminEmails: readonly string[];
  /** Secret used to encrypt auth cookies (≥ 32 characters). */
  secret: string;
  /** Maximum admin session length in seconds (refresh-token cookie lifetime). */
  sessionMaxAge: number;
  /** Secure cookies (+ __Host- prefix) whenever the app runs on https. */
  secureCookies: boolean;
}

export class AuthConfigError extends Error {}

let cached: AuthConfig | null = null;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AuthConfigError(`Missing environment variable ${name}`);
  return value;
}

export function getAuthConfig(): AuthConfig {
  if (cached) return cached;

  const region = required("COGNITO_REGION");
  const userPoolId = required("COGNITO_USER_POOL_ID");
  const clientId = required("COGNITO_CLIENT_ID");
  const domain = required("COGNITO_DOMAIN").replace(/\/+$/, "");
  const redirectUri = required("AUTH_REDIRECT_URI");
  const logoutRedirectUri = required("AUTH_LOGOUT_REDIRECT_URI");
  const secret = required("AUTH_SECRET");
  // ADMIN_EMAILS is the documented name; ADMIN_EMAIL is accepted as a fallback.
  const rawAdmins = process.env.ADMIN_EMAILS?.trim() || process.env.ADMIN_EMAIL?.trim();
  if (!rawAdmins) throw new AuthConfigError("Missing environment variable ADMIN_EMAILS");
  const { emails: adminEmails, invalidCount } = parseAdminEmails(rawAdmins);
  if (invalidCount > 0) {
    // Count only: the allow-list values are never logged.
    console.warn(`[auth] ADMIN_EMAILS: ignored ${invalidCount} entr${invalidCount === 1 ? "y" : "ies"} that are not valid email addresses`);
  }

  if (secret.length < 32) throw new AuthConfigError("AUTH_SECRET must be at least 32 characters");
  if (adminEmails.length === 0) throw new AuthConfigError("ADMIN_EMAILS must list at least one valid email");
  for (const [name, value] of [["COGNITO_DOMAIN", domain], ["AUTH_REDIRECT_URI", redirectUri], ["AUTH_LOGOUT_REDIRECT_URI", logoutRedirectUri]]) {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !local) throw new AuthConfigError(`${name} must use https`);
  }

  // The issuer is derived from region + pool. COGNITO_ISSUER may override it
  // (only needed for automated tests against a local mock identity provider).
  const issuer = (process.env.COGNITO_ISSUER?.trim() || `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`).replace(/\/+$/, "");
  const maxAge = Number(process.env.AUTH_SESSION_MAX_AGE ?? 12 * 60 * 60);

  cached = {
    clientId,
    domain,
    issuer,
    jwksUrl: `${issuer}/.well-known/jwks.json`,
    redirectUri,
    logoutRedirectUri,
    scopes: process.env.COGNITO_SCOPES?.trim() || "openid email phone",
    adminEmails,
    secret,
    sessionMaxAge: Number.isFinite(maxAge) && maxAge > 0 ? Math.floor(maxAge) : 12 * 60 * 60,
    secureCookies: new URL(redirectUri).protocol === "https:",
  };
  return cached;
}
