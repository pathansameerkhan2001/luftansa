/**
 * Auth cookie names and options. All auth cookies are HttpOnly (never readable
 * by browser JavaScript), SameSite=Lax, Path=/ and, on https, Secure with the
 * __Host- prefix (bound to this exact host, no Domain attribute).
 */
import type { AuthConfig } from "./config";

export interface CookieNames {
  /** Encrypted Cognito ID token. */
  session: string;
  /** Encrypted Cognito refresh token. */
  refresh: string;
  /** Encrypted one-time login transaction (state, nonce, PKCE verifier). */
  transaction: string;
}

export function cookieNames(config: Pick<AuthConfig, "secureCookies">): CookieNames {
  const p = config.secureCookies ? "__Host-" : "";
  return { session: `${p}lf_session`, refresh: `${p}lf_refresh`, transaction: `${p}lf_auth_tx` };
}

export function cookieOptions(config: Pick<AuthConfig, "secureCookies">, maxAge: number) {
  return {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Expires a cookie with the same attributes it was set with (required for __Host- cookies). */
export function clearCookie(
  cookies: { set: (name: string, value: string, options: ReturnType<typeof cookieOptions>) => unknown },
  config: Pick<AuthConfig, "secureCookies">,
  name: string,
) {
  cookies.set(name, "", cookieOptions(config, 0));
}

/** Login transaction lifetime: the user must finish Managed Login within this window. */
export const TRANSACTION_TTL_SECONDS = 10 * 60;
