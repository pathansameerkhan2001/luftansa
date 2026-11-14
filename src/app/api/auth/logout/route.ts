import { NextResponse, type NextRequest } from "next/server";
import { cognitoLogoutUrl, revokeRefreshToken } from "@/lib/auth/cognito";
import { getAuthConfig } from "@/lib/auth/config";
import { clearCookie, cookieNames } from "@/lib/auth/cookies";
import { unseal } from "@/lib/auth/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout (form submit from the admin dashboard).
 * Same-origin only. Revokes the refresh token, clears every auth cookie and
 * redirects to Cognito /logout, which ends the Managed Login session and
 * returns to AUTH_LOGOUT_REDIRECT_URI.
 */
export async function POST(request: NextRequest) {
  // CSRF guard: the request must come from this site.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let config;
  try {
    config = getAuthConfig();
  } catch {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }
  const names = cookieNames(config);

  const sealed = await unseal<{ t: string }>(request.cookies.get(names.refresh)?.value, config.secret);
  if (sealed?.t) await revokeRefreshToken(config, sealed.t);

  const response = NextResponse.redirect(cognitoLogoutUrl(config), { status: 303, headers: { "Cache-Control": "no-store" } });
  clearCookie(response.cookies, config, names.session);
  clearCookie(response.cookies, config, names.refresh);
  clearCookie(response.cookies, config, names.transaction);
  return response;
}

/** Logout must be an explicit POST (link prefetching must never sign anyone out). */
export function GET() {
  return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
