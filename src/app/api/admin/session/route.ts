import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/session: the signed-in administrator (email + expiry only, never tokens). */
export const GET = withAdmin(async (_request, { session }) =>
  NextResponse.json({ email: session.email, expiresAt: session.expiresAt }),
);
