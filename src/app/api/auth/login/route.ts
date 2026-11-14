import { NextResponse, type NextRequest } from "next/server";
import { AuthConfigError, getAuthConfig } from "@/lib/auth/config";
import { cookieNames, cookieOptions, TRANSACTION_TTL_SECONDS } from "@/lib/auth/cookies";
import { pkceChallenge, randomToken, seal } from "@/lib/auth/crypto";
import { safeReturnTo } from "@/lib/auth/return-to";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/login?returnTo=/admin/...
 * Starts the Authorization Code + PKCE flow: creates state, nonce and code
 * verifier, stores them in an encrypted one-time HttpOnly cookie and redirects
 * to Cognito Managed Login.
 */
export async function GET(request: NextRequest) {
  let config;
  try {
    config = getAuthConfig();
  } catch (e) {
    if (e instanceof AuthConfigError) console.error(`[auth] ${e.message}`);
    return NextResponse.redirect(new URL("/admin/login?error=config", request.url), { headers: { "Cache-Control": "no-store" } });
  }

  const state = randomToken(32);
  const nonce = randomToken(32);
  const codeVerifier = randomToken(48); // 64 chars, within RFC 7636's 43–128
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  const authorize = new URL(`${config.domain}/oauth2/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("scope", config.scopes);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("code_challenge", await pkceChallenge(codeVerifier));
  authorize.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorize, { headers: { "Cache-Control": "no-store" } });
  const names = cookieNames(config);
  response.cookies.set(
    names.transaction,
    await seal({ state, nonce, cv: codeVerifier, rt: returnTo }, config.secret, TRANSACTION_TTL_SECONDS),
    cookieOptions(config, TRANSACTION_TTL_SECONDS),
  );
  return response;
}
