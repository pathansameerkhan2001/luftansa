import "server-only";

import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthConfig } from "./config";
import { cookieNames } from "./cookies";
import { getAdminSession } from "./server";
import { readSession, type AdminSession } from "./session";

/**
 * Shared administrator authorization. Every admin page, server action and
 * /api/admin route calls one of these itself (in addition to the middleware),
 * so no admin operation depends on the middleware alone.
 */

/** Admin pages / server components: returns the session or redirects to sign-in. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Same-origin check for state-changing requests. Requires the Origin header
 * to match this site; if a browser omits Origin, Sec-Fetch-Site must be
 * "same-origin". Requests with neither are rejected.
 */
export function isSameOriginWrite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === request.nextUrl.origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export type AdminApiAuth = { ok: true; session: AdminSession } | { ok: false; response: NextResponse };

/** /api/admin/* handlers: verifies the admin session and, for writes, the origin. */
export async function requireAdminApi(request: NextRequest): Promise<AdminApiAuth> {
  let config;
  try {
    config = getAuthConfig();
  } catch {
    return { ok: false, response: jsonError(503, "auth_not_configured") };
  }
  const session = await readSession(config, request.cookies.get(cookieNames(config).session)?.value);
  if (!session) return { ok: false, response: jsonError(401, "unauthorized") };
  if (!SAFE_METHODS.has(request.method) && !isSameOriginWrite(request)) {
    return { ok: false, response: jsonError(403, "cross_origin_request") };
  }
  return { ok: true, session };
}

/** Route segment params as Next.js passes them to route handlers. */
type RouteParams = Record<string, string | string[]>;
type RouteContext<P extends RouteParams> = { params: Promise<P> };
type Handler<P extends RouteParams> = (
  request: NextRequest,
  context: RouteContext<P> & { session: AdminSession },
) => Promise<Response> | Response;

/** Wraps a route handler so it only runs for an authorised administrator. */
export function withAdmin<P extends RouteParams = Record<string, never>>(handler: Handler<P>) {
  return async (request: NextRequest, context: RouteContext<P>): Promise<Response> => {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return auth.response;
    const response = await handler(request, { ...context, session: auth.session });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}
