import type { JWTPayload } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, checkAdmin, exchangeCode, verifyIdToken } from "@/lib/auth/cognito";
import { AuthConfigError, getAuthConfig } from "@/lib/auth/config";
import { clearCookie, cookieNames, cookieOptions } from "@/lib/auth/cookies";
import { safeEqual, unseal } from "@/lib/auth/crypto";
import { safeReturnTo } from "@/lib/auth/return-to";
import { sealToken } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginTransaction extends JWTPayload {
  state: string;
  nonce: string;
  cv: string;
  rt: string;
}

/**
 * GET /api/auth/callback?code=…&state=…
 * Validates state (one-time, constant-time), exchanges the code with the PKCE
 * verifier, verifies the ID token (signature, issuer, audience, expiry,
 * token_use, nonce) and checks the administrator email before creating the
 * session. Any failure clears the transaction and returns to /admin/login.
 */
export async function GET(request: NextRequest) {
  const fail = (code: string, names?: ReturnType<typeof cookieNames>, reason?: string) => {
    const target = new URL("/admin/login", request.url);
    target.searchParams.set("error", code);
    // Safe diagnostic code only (never tokens, emails or configuration values).
    if (reason) target.searchParams.set("reason", reason);
    const res = NextResponse.redirect(target, { headers: { "Cache-Control": "no-store" } });
    if (names && config) {
      clearCookie(res.cookies, config, names.transaction);
      clearCookie(res.cookies, config, names.session);
      clearCookie(res.cookies, config, names.refresh);
    }
    return res;
  };

  let config: ReturnType<typeof getAuthConfig> | undefined;
  try {
    config = getAuthConfig();
  } catch (e) {
    if (e instanceof AuthConfigError) console.error(`[auth] ${e.message}`);
    return fail("config");
  }
  const names = cookieNames(config);
  const params = request.nextUrl.searchParams;

  // The transaction is single-use: it is deleted on every outcome below.
  const tx = await unseal<LoginTransaction>(request.cookies.get(names.transaction)?.value, config.secret);
  if (params.get("error")) return fail(params.get("error") === "access_denied" ? "access_denied" : "provider_error", names);

  const code = params.get("code");
  const state = params.get("state");
  if (!tx || !code || !state || !safeEqual(state, tx.state)) return fail("invalid_state", names);

  try {
    const tokens = await exchangeCode(config, code, tx.cv);
    if (!tokens.id_token) throw new AuthError("invalid_token");
    const claims = await verifyIdToken(config, tokens.id_token, tx.nonce);
    const admin = checkAdmin(config, claims);
    if (!admin.ok) {
      console.warn(
        `[auth] admin check failed: reason=${admin.reason}` +
          (admin.maskedEmail ? ` email=${admin.maskedEmail}` : "") +
          ` email_verified_claim=${typeof claims.email_verified === "undefined" ? "absent" : String(claims.email_verified)}` +
          ` allowlist_size=${config.adminEmails.length}`,
      );
      return fail("not_authorized", names, admin.reason);
    }

    const response = NextResponse.redirect(new URL(safeReturnTo(tx.rt), request.url), { headers: { "Cache-Control": "no-store" } });
    clearCookie(response.cookies, config, names.transaction);
    response.cookies.set(names.session, await sealToken(config, tokens.id_token, config.sessionMaxAge), cookieOptions(config, config.sessionMaxAge));
    if (tokens.refresh_token) {
      response.cookies.set(names.refresh, await sealToken(config, tokens.refresh_token, config.sessionMaxAge), cookieOptions(config, config.sessionMaxAge));
    }
    return response;
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "callback_failed";
    console.warn(`[auth] callback rejected: ${code}`);
    return fail(code === "invalid_nonce" ? "invalid_state" : code === "invalid_grant" ? "expired_code" : "login_failed", names, code);
  }
}
