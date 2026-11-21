import { type NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/require-admin";
import { importRequestSchema } from "@/lib/catalogue/excel-import";
import { buildPlan, loadImportContext } from "@/lib/catalogue/excel-import-apply";
import { getDataServices } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/products/import/preview
 * Validates the rows read from an Excel file and returns what an import would
 * do (no database writes).
 */
export const POST = withAdmin(async (request: NextRequest) => {
  const data = getDataServices();
  if (!data) return NextResponse.json({ error: "database_not_configured", message: "The product database is not available." }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "The import request could not be read." }, { status: 400 });
  }
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", message: parsed.error.issues[0]?.message ?? "The import request is not valid." }, { status: 400 });
  }
  try {
    const ctx = await loadImportContext(data.repo);
    return NextResponse.json({ ok: true, plan: buildPlan(parsed.data, ctx) });
  } catch (e) {
    console.error("[import] preview failed:", (e as Error).message);
    return NextResponse.json({ error: "preview_failed", message: "The products could not be checked. Please try again." }, { status: 500 });
  }
});
