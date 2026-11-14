import { NextResponse, type NextRequest } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import { clearCookie, cookieNames, cookieOptions } from "@/lib/auth/cookies";
import { readSession, refreshSession } from "@/lib/auth/session";

/**
 * Protects every /admin route except /admin/login, and every /api/admin route.
 * API routes get JSON 401/503 responses instead of redirects; each API handler
 * also re-verifies authorization itself (requireAdminApi).
 * - Valid admin session (encrypted ID token, verified)  -> continue.
 * - Expired/invalid session + refresh token             -> refresh, re-verify,
 *   re-check the admin email, rotate cookies, continue.
 * - Otherwise                                           -> /admin/login.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return noStore(NextResponse.next());
  }

  let authConfig;
  try {
    authConfig = getAuthConfig();
  } catch {
    // Fail closed when auth is not configured.
    if (isApi) return noStore(NextResponse.json({ error: "auth_not_configured" }, { status: 503 }));
    return noStore(NextResponse.redirect(new URL("/admin/login?error=config", request.url)));
  }
  const names = cookieNames(authConfig);

  const session = await readSession(authConfig, request.cookies.get(names.session)?.value);
  if (session) return noStore(NextResponse.next());

  const refreshed = await refreshSession(authConfig, request.cookies.get(names.refresh)?.value);
  if (!refreshed) {
    if (isApi) {
      const res = noStore(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
      clearCookie(res.cookies, authConfig, names.session);
      clearCookie(res.cookies, authConfig, names.refresh);
      return res;
    }
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("returnTo", pathname + search);
    if (request.cookies.has(names.session) || request.cookies.has(names.refresh)) login.searchParams.set("error", "session_expired");
    const res = noStore(NextResponse.redirect(login));
    clearCookie(res.cookies, authConfig, names.session);
    clearCookie(res.cookies, authConfig, names.refresh);
    return res;
  }

  // Make the refreshed session visible to server components in this request…
  request.cookies.set(names.session, refreshed.sealedSession);
  if (refreshed.sealedRefresh) request.cookies.set(names.refresh, refreshed.sealedRefresh);
  const res = noStore(NextResponse.next({ request: { headers: request.headers } }));
  // …and persist it in the browser.
  res.cookies.set(names.session, refreshed.sealedSession, cookieOptions(authConfig, authConfig.sessionMaxAge));
  if (refreshed.sealedRefresh) {
    res.cookies.set(names.refresh, refreshed.sealedRefresh, cookieOptions(authConfig, authConfig.sessionMaxAge));
  }
  return res;
}

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
  // Node.js runtime (stable in Next.js 15.5): same crypto/runtime as the auth route handlers.
  runtime: "nodejs",
};
