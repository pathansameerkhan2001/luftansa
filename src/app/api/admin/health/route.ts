import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/admin/system-status";
import { withAdmin } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/admin/health: configuration status (no secrets, no AWS calls).
 * POST /api/admin/health: same response; a side-effect-free probe of the
 *      write path (admin session + same-origin enforcement) for monitoring.
 */
const handler = withAdmin(async () => NextResponse.json({ auth: "ok", ...getSystemStatus() }));

export const GET = handler;
export const POST = handler;
